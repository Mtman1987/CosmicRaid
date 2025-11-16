'use client';

import * as React from 'react';
import { FirebaseApp, FirebaseOptions, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  User,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  Firestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  getFirestore,
} from 'firebase/firestore';
import { Functions, getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { FirebaseStorage, connectStorageEmulator, getStorage } from 'firebase/storage';

import { FirebaseErrorEmitter } from './error-emitter';
import { EMULATORS_STARTED } from './errors';

type FirebaseContextValue = {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
};

export const FirebaseContext = React.createContext<FirebaseContextValue | null>(null);

export const useFirebase = () => React.useContext(FirebaseContext);

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.NEXT_PUBLIC_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.NEXT_PUBLIC_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.NEXT_PUBLIC_PROJECT_ID,
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_STORAGE_BUCKET,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
    process.env.NEXT_PUBLIC_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? process.env.NEXT_PUBLIC_APP_ID,
};

function createFirebaseApp(): FirebaseApp {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp(firebaseConfig);
}

export const FirebaseProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const app = React.useMemo(() => createFirebaseApp(), []);

  const auth = React.useMemo(() => getAuth(app), [app]);
  const firestore = React.useMemo(() => getFirestore(app), [app]);
  const functions = React.useMemo(() => getFunctions(app), [app]);
  const storage = React.useMemo(() => getStorage(app), [app]);

  React.useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.error('Failed to set auth persistence:', error);
    });
  }, [auth]);

  React.useEffect(() => {
    if (process.env.NEXT_PUBLIC_EMULATORS_ENABLED !== 'true') {
      return;
    }

    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      connectStorageEmulator(storage, '127.0.0.1', 9199);
    } catch (error) {
      const err = error as { code?: string };
      if (err.code !== EMULATORS_STARTED) {
        FirebaseErrorEmitter.getInstance().emit('error', error);
      }
    }
  }, [auth, firestore, functions, storage]);

  return (
    <FirebaseContext.Provider value={{ app, auth, firestore, functions, storage }}>
      {children}
    </FirebaseContext.Provider>
  );
};

function useFirebaseContext(): FirebaseContextValue {
  const context = React.useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebaseContext must be used within a FirebaseProvider.');
  }
  return context;
}

export const useFirebaseApp = () => useFirebaseContext().app;
export const useAuth = () => useFirebaseContext().auth;
export const useFirestore = () => useFirebaseContext().firestore;
export const useFunctions = () => useFirebaseContext().functions;
export const useStorage = () => useFirebaseContext().storage;

export interface UseUserResult {
  user: User | null;
  isUserLoading: boolean;
}

export const useUser = (): UseUserResult => {
  const auth = useAuth();
  const [user, setUser] = React.useState<User | null>(auth.currentUser);
  const [isUserLoading, setIsUserLoading] = React.useState(!auth.currentUser);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setIsUserLoading(false);
    });
    return unsubscribe;
  }, [auth]);

  return { user, isUserLoading };
};

export const useEnsureAnonymousAuth = () => {
  const auth = useAuth();

  React.useEffect(() => {
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((error) => {
        FirebaseErrorEmitter.getInstance().emit('error', error);
      });
    }
  }, [auth]);
};

let hasEnabledPersistence = false;

export const useEnableOfflinePersistence = () => {
  const firestore = useFirestore();

  React.useEffect(() => {
    if (hasEnabledPersistence) {
      return;
    }
    hasEnabledPersistence = true;
    enableIndexedDbPersistence(firestore).catch((error) => {
      const err = error as { code?: string };
      if (err.code === 'failed-precondition' || err.code === 'unimplemented') {
        return;
      }
      if (err.code === 'already-initialized') {
        return;
      }
      FirebaseErrorEmitter.getInstance().emit('error', error);
    });
  }, [firestore]);
};
