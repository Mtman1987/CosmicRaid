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

  const listenOnly = process.env.NEXT_PUBLIC_HEARTBEAT_LISTEN_ONLY === 'true';
  // Allow hosted env to control/disable polling (0 = no interval)
  const intervalMs = React.useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_HEARTBEAT_INTERVAL_MS;
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, []);

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
    if (listenOnly) return undefined;
    checkStatus();
    if (intervalMs > 0) {
      const interval = setInterval(checkStatus, intervalMs);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [checkStatus, intervalMs, listenOnly]);

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
