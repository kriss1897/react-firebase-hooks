import { database } from 'firebase';
import { useEffect, useReducer, useRef, useState } from 'react';

export type ListHook = {
  error?: Object;
  list: database.DataSnapshot[];
  loading: boolean;
};

type KeyValueState = {
  keys: string[];
  values: database.DataSnapshot[];
};

type ReducerState = {
  error?: object;
  loading: boolean;
  value: KeyValueState;
};

type AddAction = {
  type: 'add';
  previousKey?: string | null;
  snapshot: database.DataSnapshot | null;
};
type ChangeAction = {
  type: 'change';
  snapshot: database.DataSnapshot | null;
};
type ErrorAction = { type: 'error'; error: object };
type MoveAction = {
  type: 'move';
  previousKey?: string | null;
  snapshot: database.DataSnapshot | null;
};
type RemoveAction = {
  type: 'remove';
  snapshot: database.DataSnapshot | null;
};
type ResetAction = { type: 'reset' };
type ValueAction = { type: 'value'; value: any };
type ReducerAction =
  | AddAction
  | ChangeAction
  | ErrorAction
  | MoveAction
  | RemoveAction
  | ResetAction
  | ValueAction;

const initialState: ReducerState = {
  loading: true,
  value: {
    keys: [],
    values: [],
  },
};

const reducer = (state: ReducerState, action: ReducerAction): ReducerState => {
  switch (action.type) {
    case 'add':
      if (!action.snapshot) {
        return state;
      }
      return {
        ...state,
        value: addChild(state.value, action.snapshot, action.previousKey),
      };
    case 'change':
      if (!action.snapshot) {
        return state;
      }
      return {
        ...state,
        value: changeChild(state.value, action.snapshot),
      };
    case 'error':
      return {
        ...state,
        error: action.error,
        loading: false,
      };
    case 'move':
      if (!action.snapshot) {
        return state;
      }
      return {
        ...state,
        value: moveChild(state.value, action.snapshot, action.previousKey),
      };
    case 'remove':
      if (!action.snapshot) {
        return state;
      }
      return {
        ...state,
        value: removeChild(state.value, action.snapshot),
      };
    case 'reset':
      return initialState;
    case 'value':
      return {
        ...state,
        loading: false,
        value: action.value,
      };
    default:
      return state;
  }
};

export default (query: database.Query): ListHook => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  // Combine keys and values in a single state hook to allow them to be manipulated together
  const [{ values }, setKeysValues] = useState({ keys: [], values: [] });
  // Set a ref for the query to make sure that `useEffect` doesn't run
  // every time this renders
  const queryRef = useRef(query);
  // If the query has changed, then reset the state
  if (!query.isEqual(queryRef.current)) {
    queryRef.current = query;
    dispatch({ type: 'reset' });
  }

  const onChildAdded = (
    snapshot: database.DataSnapshot | null,
    previousKey?: string | null
  ) => {
    dispatch({ type: 'add', previousKey, snapshot });
  };

  const onChildChanged = (snapshot: database.DataSnapshot | null) => {
    dispatch({ type: 'change', snapshot });
  };

  const onChildMoved = (
    snapshot: database.DataSnapshot | null,
    previousKey?: string | null
  ) => {
    dispatch({ type: 'move', previousKey, snapshot });
  };

  const onChildRemoved = (snapshot: database.DataSnapshot | null) => {
    dispatch({ type: 'remove', snapshot });
  };

  useEffect(
    () => {
      const query: database.Query = queryRef.current;
      // This is here to indicate that all the data has been successfully received
      query.once(
        'value',
        () => {
          setLoading(false);
        },
        (err: object) => {
          setError(err);
          setLoading(false);
        }
      );
      query.on('child_added', onChildAdded);
      query.on('child_changed', onChildChanged);
      query.on('child_moved', onChildMoved);
      query.on('child_removed', onChildRemoved);

      return () => {
        query.off('child_added', onChildAdded);
        query.off('child_changed', onChildChanged);
        query.off('child_moved', onChildMoved);
        query.off('child_removed', onChildRemoved);
      };
    },
    [queryRef.current]
  );

  return {
    error,
    list: values,
    loading,
  };
};

const addChild = (
  currentState: KeyValueState,
  snapshot: firebase.database.DataSnapshot,
  previousKey?: string | null
): KeyValueState => {
  if (!snapshot.key) {
    return currentState;
  }

  const { keys, values } = currentState;
  if (!previousKey) {
    // The child has been added to the start of the list
    return {
      keys: [snapshot.key, ...keys],
      values: [snapshot, ...values],
    };
  }
  // Establish the index for the previous child in the list
  const index = keys.indexOf(previousKey);
  // Insert the item after the previous child
  return {
    keys: [...keys.slice(0, index + 1), snapshot.key, ...keys.slice(index + 1)],
    values: [
      ...values.slice(0, index + 1),
      snapshot,
      ...values.slice(index + 1),
    ],
  };
};

const changeChild = (
  currentState: KeyValueState,
  snapshot: firebase.database.DataSnapshot
): KeyValueState => {
  if (!snapshot.key) {
    return currentState;
  }
  const index = currentState.keys.indexOf(snapshot.key);
  return {
    ...currentState,
    values: [
      ...currentState.values.slice(0, index),
      snapshot,
      ...currentState.values.slice(index + 1),
    ],
  };
};

const removeChild = (
  currentState: KeyValueState,
  snapshot: firebase.database.DataSnapshot
): KeyValueState => {
  if (!snapshot.key) {
    return currentState;
  }

  const { keys, values } = currentState;
  const index = keys.indexOf(snapshot.key);
  return {
    keys: [...keys.slice(0, index), ...keys.slice(index + 1)],
    values: [...values.slice(0, index), ...values.slice(index + 1)],
  };
};

const moveChild = (
  currentState: KeyValueState,
  snapshot: firebase.database.DataSnapshot,
  previousKey?: string | null
): KeyValueState => {
  // Remove the child from it's previous location
  const tempValue = removeChild(currentState, snapshot);
  // Add the child into it's new location
  return addChild(tempValue, snapshot, previousKey);
};