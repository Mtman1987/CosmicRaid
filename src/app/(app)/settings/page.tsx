'use client';

import * as React from 'react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, writeBatch, Timestamp, setDoc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';

import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Trash2, Zap, Loader2, TestTube, RefreshCcw } from 'lucide-react';
import { useActionState, useFormStatus } from 'react-dom';
import { testCalendarPostAction, resetCalendarAction } from '@/lib/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CopyButton } from '@/components/copy-button';
import { AdminRoleSettings } from './_components/admin-role-settings';
import { UISettingsCard } from './_components/ui-settings';
import { cn } from '@/lib/utils';


function TestButton() {
    const { pending } = useFormStatus();
    return (
        <Button className="w-full" variant="outline" type="submit" disabled={pending}>
            {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <TestTube className="mr-2 h-4 w-4" />
            )}
            Test Calendar Post
        </Button>
    )
}

function ResetCalendarButton() {
    const { pending } = useFormStatus();
    return (
        <Button className="w-full" variant="destructive" type="submit" disabled={pending}>
            {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
            )}
            Reset Calendar Data
        </Button>
    )
}

export default function SettingsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const firestore = useFirestore();

  const [guildId, setGuildId] = React.useState('');
  const [testChannelId, setTestChannelId] = React.useState('');
  
  // State for Health Check
  type HeartbeatStatus = 'checking' | 'ok' | 'error';
  const [heartbeat, setHeartbeat] = React.useState<HeartbeatStatus>('checking');
  const [heartbeatError, setHeartbeatError] = React.useState<string | null>(null);

  // State for Sync
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncMessage, setSyncMessage] = React.useState('');
  const [syncStatus, setSyncStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

  const [testState, testAction] = useActionState(testCalendarPostAction, { status: 'idle', message: '', logs: [] });
  const [resetState, resetAction] = useActionState(resetCalendarAction, { status: 'idle', message: '' });
  
  const logsAsString = React.useMemo(() => (testState.logs ?? []).join('\n'), [testState.logs]);

  React.useEffect(() => {
    const storedGuildId = localStorage.getItem('discordServerId');
    if (storedGuildId) {
      setGuildId(storedGuildId);
    } else {
      setHeartbeat('error');
      setHeartbeatError('No Server ID found in local storage.');
    }
  }, []);

  // CLIENT-SIDE Health Check
  React.useEffect(() => {
    if (!firestore || !guildId) return;

    const performClientHealthCheck = async () => {
      setHeartbeat('checking');
      setHeartbeatError(null);
      
      const healthCheckRef = doc(firestore, 'servers', guildId, 'config', 'healthCheck');

      try {
        const docSnap = await getDoc(healthCheckRef);
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        if (docSnap.exists() && docSnap.data().lastChecked.toDate() > oneDayAgo) {
            setHeartbeat('ok');
            return;
        }

        await setDoc(healthCheckRef, {
          lastChecked: Timestamp.now(),
          status: 'ok',
        }, { merge: true });

        setHeartbeat('ok');
      } catch (error) {
        setHeartbeat('error');
        const message = error instanceof Error ? error.message : 'An unknown database error occurred.';
        setHeartbeatError(message);
        console.error('Client-side health check failed:', error);
      }
    };
    
    performClientHealthCheck();
  }, [firestore, guildId]);


  const handleClientSideSync = async () => {
    if (!guildId) {
      setSyncStatus('error');
      setSyncMessage('Guild ID is required.');
      return;
    }

    setIsSyncing(true);
    setSyncStatus('idle');
    setSyncMessage('Starting sync...');

    try {
      setSyncMessage('Fetching data from Discord...');
      const response = await fetch('/api/discord/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch data from Discord.');
      }
      const data = await response.json();
      setSyncMessage('Writing to database...');

      if (!firestore) throw new Error('Firestore is not initialized.');

      const batch = writeBatch(firestore);

      const publicDiscordRef = doc(firestore, 'discords', data.server.serverId);
      batch.set(publicDiscordRef, data.server, { merge: true });

      const serverRef = doc(firestore, 'servers', data.server.serverId);
      batch.set(serverRef, data.server, { merge: true });
      
      const rolesRef = doc(serverRef, 'config', 'roles');
      const roleNames = data.roles.map((r: any) => r.name).filter((name: string) => name !== '@everyone');
      batch.set(rolesRef, { list: roleNames });

      const channelsRef = doc(serverRef, 'config', 'channels');
      const textChannels = data.channels
        .filter((c: any) => c.type === 0)
        .map((c: any) => ({ id: c.id, name: c.name }));
      batch.set(channelsRef, { list: textChannels });

      for (const member of data.members) {
        if (member.user.bot) continue;
        const userRef = doc(serverRef, 'users', member.user.id);
        const userRoles = member.roles.map((roleId: string) => data.roles.find((r: any) => r.id === roleId)?.name).filter(Boolean);
        batch.set(userRef, {
          discordUserId: member.user.id,
          username: member.user.username,
          avatarUrl: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${parseInt(member.user.discriminator) % 5}.png`,
          roles: userRoles,
          group: 'Community',
          isOnline: false,
          topic: ''
        }, { merge: true });
      }

      await batch.commit();

      setSyncStatus('success');
      setSyncMessage(`Sync complete! Wrote ${data.members.length} members, ${data.roles.length} roles, and ${textChannels.length} channels.`);

    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      setSyncStatus('error');
      setSyncMessage(message);
      console.error('Client-side sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  };


  const handleReset = () => {
    localStorage.clear();
    router.push('/login');
  };
  
  const getHeartbeatDescription = () => {
    switch (heartbeat) {
        case 'ok':
            return "Database connection is healthy. Ready to sync.";
        case 'error':
            return heartbeatError || "Database connection failed. Check server logs.";
        case 'checking':
            return "Checking database connection...";
        default:
            return "Configure your server to check the database connection.";
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Configure your application and integrations."
      />
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline flex items-center gap-3">
                    <span
                        className={cn(
                        'h-3 w-3 rounded-full',
                        {
                            'bg-green-500': heartbeat === 'ok',
                            'bg-red-500': heartbeat === 'error',
                            'bg-yellow-500 animate-pulse': heartbeat === 'checking',
                        }
                        )}
                    />
                    Database Sync
                    </CardTitle>
                    <CardDescription className={cn(heartbeat === 'error' && 'text-destructive')}>
                        {getHeartbeatDescription()}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label htmlFor="sync-guild-id">Guild (Server) ID</Label>
                        <Input id="sync-guild-id" name="guildId" value={guildId} onChange={(e) => setGuildId(e.target.value)} required />
                    </div>
                    {syncStatus !== 'idle' && (
                        <Alert variant={syncStatus === 'error' ? 'destructive' : 'default'} className="mt-4">
                        <AlertTitle>{syncStatus === 'success' ? 'Success!' : 'Error'}</AlertTitle>
                        <AlertDescription>{syncMessage}</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <Button className="w-full" onClick={handleClientSideSync} disabled={isSyncing || heartbeat !== 'ok'}>
                        {isSyncing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                        <Zap className="mr-2 h-4 w-4" />
                        )}
                        Sync with Discord
                    </Button>
                </CardFooter>
            </Card>
          {guildId && <AdminRoleSettings serverId={guildId} />}
        </div>
        
         <div className="space-y-8 lg:col-span-1">
            <UISettingsCard />
        </div>


        <div className="space-y-8 lg:col-span-1">
            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="font-headline text-destructive">Developer Tools</CardTitle>
                    <CardDescription>For testing and development purposes only.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button variant="destructive" className="w-full" onClick={handleReset}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Local Storage & Reset Session
                    </Button>
                    
                    <form action={testAction} className="space-y-4">
                        <input type="hidden" name="guildId" value={guildId} />
                         <div className="space-y-2">
                            <Label htmlFor="test-channel-id">Test Channel ID</Label>
                            <Input
                                id="test-channel-id"
                                name="channelId"
                                value={testChannelId}
                                onChange={(e) => setTestChannelId(e.target.value)}
                                placeholder="Enter a channel ID to post in"
                                required
                            />
                        </div>
                        <TestButton />
                        {testState.status !== 'idle' && (
                            <div className="space-y-2">
                                <Alert variant={testState.status === 'error' ? 'destructive' : 'default'}>
                                    <AlertTitle>{testState.status === 'success' ? 'Success!' : 'Error'}</AlertTitle>
                                    <AlertDescription>
                                        {testState.message}
                                    </AlertDescription>
                                </Alert>
                                {testState.logs && testState.logs.length > 0 && (
                                <div className="relative">
                                    <h4 className="text-sm font-semibold mb-2">Server Logs:</h4>
                                    <div className="absolute top-0 right-0">
                                        <CopyButton value={logsAsString} />
                                    </div>
                                    <ScrollArea className="h-48 w-full rounded-md border bg-secondary/50 p-4">
                                        <pre className="text-xs whitespace-pre-wrap break-words">
                                        {logsAsString}
                                        </pre>
                                    </ScrollArea>
                                </div>
                                )}
                            </div>
                        )}
                    </form>

                    <form action={resetAction} className="space-y-4">
                         <input type="hidden" name="guildId" value={guildId} />
                         <input type="hidden" name="currentPath" value={pathname} />
                         <ResetCalendarButton />
                         {resetState.status !== 'idle' && (
                            <Alert variant={resetState.status === 'error' ? 'destructive' : 'default'}>
                                <AlertTitle>{resetState.status === 'success' ? 'Success!' : 'Error'}</AlertTitle>
                                <AlertDescription>
                                    {resetState.message}
                                </AlertDescription>
                            </Alert>
                         )}
                    </form>

                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground">Use these tools for testing server-side functions and clearing test data.</p>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
