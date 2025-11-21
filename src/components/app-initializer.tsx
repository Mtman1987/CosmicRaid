'use client';

import * as React from 'react';
import { usePersistentData } from '@/hooks/use-persistent-data';

interface AppInitializerProps {
  children: React.ReactNode;
}

/**
 * Component that ensures all persistent data is loaded before rendering the app
 * This prevents the "reset" issue where data appears to be lost on page refresh
 */
export function AppInitializer({ children }: AppInitializerProps) {
  const { data, isLoading, serverId } = usePersistentData();
  const [isInitialized, setIsInitialized] = React.useState(false);
  
  React.useEffect(() => {
    if (!isLoading && serverId) {
      // Small delay to ensure all data is properly loaded
      const timer = setTimeout(() => {
        setIsInitialized(true);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [isLoading, serverId]);
  
  // Show loading state while data is being fetched
  if (!isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground">Loading your data...</p>
          <p className="text-xs text-muted-foreground">
            Server: {serverId || 'Not connected'}
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}