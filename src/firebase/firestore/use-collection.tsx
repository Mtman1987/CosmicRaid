'use client';

import { useEffect, useReducer, useRef } from 'react';
import {
  onSnapshot,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
  type FirestoreError,
} from 'firebase/firestore';

import { FirebaseErrorEmitter } from '../error-emitter';

interface State<T> {
  isLoading: boolean;
  data: T[] | undefined;
}

type Action<T> =
  | { type: 'loading' }
  | { type: 'data'; payload: T[] }
  | { type: 'error'; payload: FirestoreError };

const reducer = <T,>(state: State<T>, action: Action<T>): State<T> => {
  switch (action.type) {
    case 'loading':
      return { ...state, isLoading: true };
    case 'data':
      return { isLoading: false, data: action.payload };
    case 'error':
      FirebaseErrorEmitter.getInstance().emit('error', action.payload);
      return { ...state, isLoading: false };
    default:
      return state;
  }
};

type Transform<T> = (snapshot: QueryDocumentSnapshot<DocumentData>) => T;

const defaultTransform = <T,>(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): T =>
  ({
    id: snapshot.id,
    ...(snapshot.data() as Record<string, unknown>),
  } as T);

export const useCollection = <T = DocumentData,>(
  query: Query<DocumentData> | null,
  transform?: Transform<T>,
) => {
  const [state, dispatch] = useReducer(reducer<T>, {
    isLoading: true,
    data: undefined,
  });
  const previousQueryRef = useRef<Query<DocumentData> | null>(query);
  const emittedEmptyRef = useRef(false);

  useEffect(() => {
    if (previousQueryRef.current !== query) {
      previousQueryRef.current = query;
      dispatch({ type: 'loading' });
    }

    if (!query) {
      if (!emittedEmptyRef.current) {
        emittedEmptyRef.current = true;
        dispatch({ type: 'data', payload: [] });
      }
      return;
    }

    emittedEmptyRef.current = false;

    const unsubscribe = onSnapshot(
      query,
      (snapshot) => {
        const mapper = transform ?? defaultTransform<T>;
        const items = snapshot.docs.map((doc) => mapper(doc));
        dispatch({ type: 'data', payload: items });
      },
      (error) => dispatch({ type: 'error', payload: error }),
    );

    return () => unsubscribe();
  }, [query, transform]);

  return state;
};
