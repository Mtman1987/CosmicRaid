'use client';

import { useEffect, useReducer, useRef } from 'react';
import {
  onSnapshot,
  type DocumentData,
  type DocumentReference,
  type DocumentSnapshot,
  type FirestoreError,
} from 'firebase/firestore';

import { FirebaseErrorEmitter } from '../error-emitter';

interface State<T> {
  isLoading: boolean;
  data: T | undefined;
}

type Action<T> =
  | { type: 'loading' }
  | { type: 'data'; payload: T | undefined }
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

type Transform<T> = (snapshot: DocumentSnapshot<DocumentData>) => T | undefined;

const defaultTransform = <T,>(
  snapshot: DocumentSnapshot<DocumentData>,
): T | undefined => {
  if (!snapshot.exists()) {
    return undefined;
  }

  return {
    id: snapshot.id,
    ...(snapshot.data() as Record<string, unknown>),
  } as T;
};

export const useDoc = <T = DocumentData,>(
  ref: DocumentReference<DocumentData> | null,
  transform?: Transform<T>,
) => {
  const [state, dispatch] = useReducer(reducer<T>, {
    isLoading: true,
    data: undefined,
  });
  const previousRef = useRef<DocumentReference<DocumentData> | null>(ref);
  const emittedEmptyRef = useRef(false);

  useEffect(() => {
    if (previousRef.current !== ref) {
      previousRef.current = ref;
      dispatch({ type: 'loading' });
    }

    if (!ref) {
      if (!emittedEmptyRef.current) {
        emittedEmptyRef.current = true;
        dispatch({ type: 'data', payload: undefined });
      }
      return;
    }

    emittedEmptyRef.current = false;

    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        const mapper = transform ?? defaultTransform<T>;
        dispatch({ type: 'data', payload: mapper(snapshot) });
      },
      (error) => dispatch({ type: 'error', payload: error }),
    );

    return () => unsubscribe();
  }, [ref, transform]);

  return state;
};
