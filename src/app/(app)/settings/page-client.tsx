'use client';

import * as React from 'react';
import { useServerId } from '@/lib/get-server-id';
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
import { TwitchPollingSettings } from './_components/twitch-polling-settings';
import { ChannelSelectionSettings } from './_components/channel-selection-settings';
import { useToast } from '@/hooks/use-toast';

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
  const guildId = useServerId(); // Use hook instead of localStorage
  const [testChannelId, setTestChannelId] = React.useState('');
  const [botToken, setBotToken] = React.useState('');
  const [isSavingToken, setIsSavingToken] = React.useState(false);
  const { toast } = useToast();

  const [syncState, syncAction] = useActionState(syncDiscordData, { status: 'idle', message: '' });
  const [testState, testAction] = useActionState(testCalendarPostAction, { status: 'idle', message: '', logs: [] });
  const [resetState, resetAction] = useActionState(resetCalendarAction, { status: 'idle', message: '' });
  
  const logsAsString = React.useMemo(() => (testState.logs ?? []).join('\n'), [testState.logs]);

  // Bot token should be in Firestore secrets, not localStorage
  // Remove localStorage loading

  const handleReset = () => {
    // Only clear auth tokens, not configuration
    if (typeof window !== 'undefined') {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('discordServerId');
      localStorage.removeItem('discordUserId');
      localStorage.removeItem('twitchUsername');
    }
    router.push('/login');
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Configure your application and integrations."
      />
      <div className="grid gap-8 md:grid-cols-2">
        <div className="space-y-8">
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
                    placeholder="Stored in Firestore secrets"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    disabled={true}
                  />
                  <Button 
                    onClick={() => {
                      toast({
                        variant: 'destructive',
                        title: 'Bot token in Firestore',
                        description: 'Bot token is stored in Firestore secrets at servers/{serverId}/config/secrets',
                      });
                    }}
                    disabled={true}
                    size="sm"
                  >
                    <Save className="h-4 w-4" />
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
        
        <div className="space-y-8">
            <Card>
                <form action={syncAction}>
                    <CardHeader>
                        <CardTitle className="font-headline">Database Sync</CardTitle>
                        <CardDescription>
                            Populate your database with members, roles, and channels from your Discord server. This is required for most features.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <input type="hidden" name="guildId" value={guildId} />
                        <div className="space-y-2">
                            <Label htmlFor="sync-guild-id">Guild (Server) ID</Label>
                            <Input
                                id="sync-guild-id"
                                value={guildId}
                                readOnly
                                disabled
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
            <TwitchPollingSettings />
            <ChannelSelectionSettings />
        </div>


      </div>
      
      <div className="grid gap-8 md:grid-cols-2">
        {guildId && <AdminRoleSettings serverId={guildId} />}
        
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              📖 Documentation
            </CardTitle>
            <CardDescription>
              Download user guide and system information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => {
                const link = document.createElement('a');
                link.href = '/README.md';
                link.download = 'CosmicRaid-UserGuide.md';
                link.click();
              }}
            >
              📥 Download User Guide
            </Button>
          </CardContent>
        </Card>
        
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="font-headline text-destructive">Reset Session</CardTitle>
            <CardDescription>Clear login data and return to login page.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" className="w-full" onClick={handleReset}>
              <Trash2 className="mr-2 h-4 w-4" />
              Logout & Reset
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
