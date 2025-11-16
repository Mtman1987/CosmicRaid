'use client';

import { FirebaseProvider } from './client-provider';
import { NonBlockingLogin } from './non-blocking-login';
import { NonBlockingUpdates } from './non-blocking-updates';

export const FirebaseComponentsProvider: React.FC<React.PropsWithChildren> = ({ children }) => (
  <FirebaseProvider>
    <NonBlockingLogin>
      <NonBlockingUpdates>{children}</NonBlockingUpdates>
    </NonBlockingLogin>
  </FirebaseProvider>
);
