'use client';

import { useEnsureAnonymousAuth } from './client-provider';

export const NonBlockingLogin: React.FC<React.PropsWithChildren> = ({ children }) => {
  useEnsureAnonymousAuth();
  return children;
};
