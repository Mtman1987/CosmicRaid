'use client';

import * as React from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
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
import { useRouter, usePathname } from 'next/navigation';
import { syncDiscordData, testCalendarPostAction, resetCalendarAction } from '@/lib/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CopyButton } from '@/components/copy-button';
import { AdminRoleSettings } from './_components/admin-role-settings';
import { UISettingsCard } from './_components/ui-settings';
import { TwitchPollingSettings } from './_components/twitch-polling-settings';
import { DiscordSyncSettings } from './_components/discord-sync-settings';
import { ChannelSelectionSettings } from './_components/channel-selection-settings';

function SyncButton() {
    const { pending } = useFormStatus();
    return (
      <Button className="w-full" type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Zap className="mr-2 h-4 w-4" />
        )}
        Sync with Discord
      </Button>
    );
}

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
  const [guildId, setGuildId] = React.useState('');
  const [testChannelId, setTestChannelId] = React.useState('');
  const [botToken, setBotToken] = React.useState('');
  const [isSavingToken, setIsSavingToken] = React.useState(false);

  const [syncState, syncAction] = useActionState(syncDiscordData, { status: 'idle', message: '' });
  const [testState, testAction] = useActionState(testCalendarPostAction, { status: 'idle', message: '', logs: [] });
  const [resetState, resetAction] = useActionState(resetCalendarAction, { status: 'idle', message: '' });
  
  const logsAsString = React.useMemo(() => (testState.logs ?? []).join('\n'), [testState.logs]);

  React.useEffect(() => {
    const storedGuildId = localStorage.getItem('discordServerId');
    if (storedGuildId) {
      setGuildId(storedGuildId);
    }
  }, []);

  const handleReset = () => {
    localStorage.clear();
    router.push('/login');
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
              <CardTitle className="font-headline">Discord Integration</CardTitle>
              <CardDescription>
                Connect your Discord bot and server details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discord-token">Bot Token</Label>
                <div className="flex gap-2">
                  <Input
                    id="discord-token"
                    type="password"
                    placeholder="Enter your Discord bot token"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                  />
                  <Button 
                    onClick={async () => {
                      if (!guildId || !botToken) return;
                      setIsSavingToken(true);
                      try {
                        const response = await fetch('/api/save-token', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ serverId: guildId, token: botToken })
                        });
                        if (response.ok) {
                          alert('Bot token saved successfully!');
                          setBotToken('');
                        } else {
                          alert('Failed to save bot token');
                        }
                      } catch (error) {
                        alert('Failed to save bot token');
                      } finally {
                        setIsSavingToken(false);
                      }
                    }}
                    disabled={!guildId || !botToken || isSavingToken}
                    size="sm"
                  >
                    {isSavingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discord-server-id">Server ID</Label>
                <Input id="discord-server-id" value={guildId} disabled />
              </div>
            </CardContent>
          </Card>
          {guildId && <AdminRoleSettings serverId={guildId} />}
        </div>
        
         <div className="space-y-8 lg:col-span-1">
            <Card>
                <form action={syncAction}>
                    <CardHeader>
                        <CardTitle className="font-headline">Database Sync</CardTitle>
                        <CardDescription>
                            Populate your database with members, roles, and channels from your Discord server. This is required for most features.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="sync-guild-id">Guild (Server) ID</Label>
                            <Input
                                id="sync-guild-id"
                                name="guildId"
                                value={guildId}
                                onChange={(e) => setGuildId(e.target.value)}
                                required
                            />
                        </div>
                        {syncState.status !== 'idle' && (
                            <Alert variant={syncState.status === 'error' ? 'destructive' : 'default'}>
                                <AlertTitle>{syncState.status === 'success' ? 'Success!' : 'Error'}</AlertTitle>
                                <AlertDescription>{syncState.message}</AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                    <CardFooter>
                        <SyncButton />
                    </CardFooter>
                </form>
            </Card>
            <UISettingsCard />
            <TwitchPollingSettings />
        </div>
        
        <div className="lg:col-span-3 space-y-6">
            <DiscordSyncSettings />
            <ChannelSelectionSettings />
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
                    
                    <Button 
                        variant="outline" 
                        className="w-full" 
                        onClick={async () => {
                            try {
                                const response = await fetch('/api/points/add', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ 
                                        userId: process.env.NEXT_PUBLIC_HARDCODED_ADMIN_DISCORD_ID || 'mtman1987',
                                        username: 'mtman1987', 
                                        displayName: 'mtman1987',
                                        points: 200 
                                    })
                                });
                                const result = await response.json();
                                alert('Added 200 points to mtman1987!');
                            } catch (error) {
                                alert('Error adding points');
                            }
                        }}
                    >
                        <Zap className="mr-2 h-4 w-4" />
                        Add 200 Points to mtman1987
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
