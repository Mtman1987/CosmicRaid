
'use client';
import { PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, Film, TestTube } from 'lucide-react';
import * as React from 'react';

type ActionState = 'idle' | 'loading' | 'success' | 'error';
type ActionType = 'calendar' | 'leaderboard' | 'shoutouts';

const ENDPOINT_MAP: Record<ActionType, string> = {
  calendar: '/api/dispatch/calendar',
  leaderboard: '/api/dispatch/leaderboard',
  shoutouts: '/api/dispatch/shoutout-cycle',
};

// Hardcoded values for simplified testing
const SERVER_ID = '1240832965865635881';
const CHANNEL_ID = '1341946492696526858';


export default function MissionControlPage() {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = React.useState(false);
  const [actionStates, setActionStates] = React.useState<Record<ActionType, ActionState>>({
    calendar: 'idle',
    leaderboard: 'idle',
    shoutouts: 'idle',
  });

  const handleDispatch = async (type: ActionType) => {
    setActionStates(prev => ({ ...prev, [type]: 'loading' }));
    
    const endpoint = ENDPOINT_MAP[type];
    const body = type === 'shoutouts' ? { serverId: SERVER_ID } : { serverId: SERVER_ID, channelId: CHANNEL_ID };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
  
  const handleTestPost = async () => {
    setIsTesting(true);
    try {
        const response = await fetch('/api/discord/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                channelId: CHANNEL_ID,
                content: 'Hello from Firebase Studio! The bot is connected. ✅'
            }),
        });
        
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'An unknown error occurred.');
        }

        toast({
            title: 'Test Message Sent!',
            description: `Successfully posted to channel ${CHANNEL_ID}.`,
        });

    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred';
        toast({
            variant: 'destructive',
            title: 'Test Failed',
            description: message,
        });
    } finally {
        setIsTesting(false);
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
              Dispatch actions are hardcoded for testing.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 text-sm">
             <div>
                <p className="font-semibold text-muted-foreground">Server ID:</p>
                <p className="font-mono">{SERVER_ID}</p>
             </div>
             <div>
                <p className="font-semibold text-muted-foreground">Channel ID:</p>
                <p className="font-mono">{CHANNEL_ID}</p>
             </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>🧪 Connection Test</CardTitle>
            <CardDescription>
              Send a simple "Hello World" message to the target channel to verify your bot token and permissions.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button className="w-full" variant="secondary" onClick={handleTestPost} disabled={isTesting}>
              {isTesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
              Send Test Message
            </Button>
          </CardFooter>
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

        <Card>
          <CardHeader>
            <CardTitle>📣 Shoutout Cycle</CardTitle>
            <CardDescription>
              Manually trigger a full shoutout cycle for all configured groups and channels.
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
