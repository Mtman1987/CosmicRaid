'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useServerConfig, useShoutoutChannel } from '@/lib/use-server-config';
import { useServerId } from '@/lib/get-server-id';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export function PersistenceTest() {
  const serverId = useServerId();
  const firestore = useFirestore();
  const { config, isLoading: configLoading, get, set } = useServerConfig();
  const { channelId: vipChannelId, isLoading: vipChannelLoading, saveChannel: saveVipChannel } = useShoutoutChannel('vip');
  
  // Test admin roles persistence
  const adminRolesRef = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return doc(firestore, 'servers', serverId, 'config', 'settings');
  }, [firestore, serverId]);
  
  const { data: adminRolesData, isLoading: adminRolesLoading } = useDoc<{ adminRoles?: string[] }>(adminRolesRef);
  
  // Test channel settings persistence
  const channelsRef = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return doc(firestore, 'servers', serverId, 'config', 'channels');
  }, [firestore, serverId]);
  
  const { data: channelsData, isLoading: channelsLoading } = useDoc<Record<string, string>>(channelsRef);
  
  const [testResults, setTestResults] = React.useState<Record<string, boolean>>({});
  
  const runPersistenceTest = async () => {
    const results: Record<string, boolean> = {};
    
    try {
      // Test 1: Server config persistence
      const testKey = 'persistenceTest';
      const testValue = Date.now().toString();
      await set(testKey, testValue);
      
      // Wait a moment then check if it persisted
      setTimeout(async () => {
        const retrievedValue = get(testKey);
        results.serverConfig = retrievedValue === testValue;
        
        // Test 2: VIP channel persistence
        const testChannelId = '123456789012345678';
        await saveVipChannel(testChannelId);
        results.vipChannel = vipChannelId === testChannelId;
        
        // Test 3: Admin roles exist
        results.adminRoles = Array.isArray(adminRolesData?.adminRoles);
        
        // Test 4: Channel settings exist
        results.channelSettings = typeof channelsData === 'object' && channelsData !== null;
        
        setTestResults(results);
      }, 1000);
      
    } catch (error) {
      console.error('Persistence test failed:', error);
      setTestResults({ error: false });
    }
  };
  
  const isLoading = configLoading || vipChannelLoading || adminRolesLoading || channelsLoading;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Data Persistence Test
        </CardTitle>
        <CardDescription>
          Test if VIP lists, role mappings, and channel settings are properly persisting to Firestore
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold">Current Data Status</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={adminRolesData?.adminRoles?.length ? 'default' : 'secondary'}>
                  Admin Roles: {adminRolesData?.adminRoles?.length || 0}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={vipChannelId ? 'default' : 'secondary'}>
                  VIP Channel: {vipChannelId || 'Not set'}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={channelsData ? 'default' : 'secondary'}>
                  Channel Settings: {Object.keys(channelsData || {}).length} configured
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Test Results</h4>
            <div className="space-y-1">
              {Object.entries(testResults).map(([test, passed]) => (
                <div key={test} className="flex items-center gap-2">
                  {passed ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">{test}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <Button 
          onClick={runPersistenceTest} 
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Loading...' : 'Run Persistence Test'}
        </Button>
        
        <div className="text-xs text-muted-foreground">
          <p><strong>Server ID:</strong> {serverId}</p>
          <p><strong>Firestore Connected:</strong> {firestore ? 'Yes' : 'No'}</p>
        </div>
      </CardContent>
    </Card>
  );
}