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
import { Zap, Loader2 } from 'lucide-react';
import { syncDiscordData } from '@/lib/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export default function SettingsPage() {
  const [guildId, setGuildId] = React.useState('');

  const [syncState, syncAction] = useActionState(syncDiscordData, { status: 'idle', message: '' });
  
  React.useEffect(() => {
    const storedGuildId = localStorage.getItem('discordServerId');
    if (storedGuildId) {
      setGuildId(storedGuildId);
    }
  }, []);


  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Configure your application and integrations."
      />
      <div className="grid gap-8 max-w-md">
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
                            <AlertDescription>
                                {syncState.message}
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
                <CardFooter>
                    <SyncButton />
                </CardFooter>
            </form>
        </Card>
      </div>
    </div>
  );
}
