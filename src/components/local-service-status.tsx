'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Wifi, WifiOff } from 'lucide-react';

export function LocalServiceStatus() {
  const [status, setStatus] = React.useState<{
    connected: boolean;
    error?: string;
    timestamp?: string;
  }>({ connected: false });

  const checkStatus = React.useCallback(async () => {
    try {
      const response = await fetch('/api/heartbeat');
      const data = await response.json();
      setStatus(data);
    } catch (error) {
      setStatus({ 
        connected: false, 
        error: 'Failed to check status' 
      });
    }
  }, []);

  React.useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [checkStatus]);

  return (
    <Badge 
      variant={status.connected ? 'default' : 'destructive'}
      className="flex items-center gap-1"
    >
      {status.connected ? (
        <>
          <Wifi className="h-3 w-3" />
          Local Service Connected
        </>
      ) : (
        <>
          <WifiOff className="h-3 w-3" />
          Local Service Offline
        </>
      )}
    </Badge>
  );
}