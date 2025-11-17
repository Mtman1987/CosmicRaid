'use client';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send } from 'lucide-react';
import * as React from 'react';

type ActionState = 'idle' | 'loading' | 'success' | 'error';
type ActionType = 'calendar' | 'leaderboard' | 'shoutouts';

export default function MissionControlPage() {
  const { toast } = useToast();
  const [serverId, setServerId] = React.useState('');
  const [channelId, setChannelId] = React.useState('');
  const [actionStates, setActionStates] = React.useState<Record<ActionType, ActionState>>({
    calendar: 'idle',
    leaderboard: 'idle',
    shoutouts: 'idle',
  });

  React.useEffect(() => {
    const storedServerId = localStorage.getItem('discordServerId');
    if (storedServerId) {
      setServerId(storedServerId);
    }
  }, []);

  const handleDispatch = async (type: ActionType) => {
    if (!serverId || !channelId) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please provide both a Server ID and a Channel ID.',
      });
      return;
    }

    setActionStates(prev => ({ ...prev, [type]: 'loading' }));

    try {
      const response = await fetch(`/api/dispatch/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, channelId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'An unknown error occurred.');
      }

      toast({
        title: 'Dispatch Successful',
        description: result.message || `${type} posted to Discord.`,
      });
      setActionStates(prev => ({ ...prev, [type]: 'success' }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast({
        variant: 'destructive',
        title: 'Dispatch Failed',
        description: message,
      });
      setActionStates(prev => ({ ...prev, [type]: 'error' }));
    } finally {
      setTimeout(() => setActionStates(prev => ({ ...prev, [type]: 'idle' })), 3000);
    }
  };

  const isLoading = (type: ActionType) => actionStates[type] === 'loading';

  return (
    <div className="container mx-auto p-4 md:p-8">
      <PageHeader
        title="🚀 Mission Control"
        description="A centralized dispatch for all your community's Discord embeds."
      />

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Set the Discord Server and Channel ID for all dispatch actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="server-id">Discord Server ID</Label>
              <Input
                id="server-id"
                placeholder="Enter your server ID"
                value={serverId}
                onChange={(e) => setServerId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel-id">Target Channel ID</Label>
              <Input
                id="channel-id"
                placeholder="Enter the channel ID to post to"
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📅 Calendar Embed</CardTitle>
            <CardDescription>
              Generate and post the latest community calendar and mission log to your selected channel.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => handleDispatch('calendar')} disabled={isLoading('calendar')}>
              {isLoading('calendar') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Dispatch Calendar
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🏆 Leaderboard Embed</CardTitle>
            <CardDescription>
              Generate and post the current leaderboard snapshot to your selected channel.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => handleDispatch('leaderboard')} disabled={isLoading('leaderboard')}>
               {isLoading('leaderboard') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Dispatch Leaderboard
            </Button>
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>📣 Shoutout Cycle</CardTitle>
            <CardDescription>
              Manually trigger a full shoutout cycle. This will poll Twitch, update online statuses, generate shoutouts for all live members (VIP and Community), and post them to their configured channels.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" onClick={() => handleDispatch('shoutouts')} disabled={isLoading('shoutouts')}>
               {isLoading('shoutouts') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Dispatch All Shoutouts
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
