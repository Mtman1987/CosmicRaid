'use client';

import { useEnableOfflinePersistence } from './client-provider';

export const NonBlockingUpdates: React.FC<React.PropsWithChildren> = ({ children }) => {
  useEnableOfflinePersistence();
  return children;
};
