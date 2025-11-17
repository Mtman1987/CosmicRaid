'use client';

import * as React from 'react';
import { useServerId } from '@/hooks/use-space-mountain-auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Play, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Status = 'idle' | 'loading' | 'success' | 'error';

export function ShoutoutAutomationSettings() {
  const serverId = useServerId();
  const { toast } = useToast();
  const [status, setStatus] = React.useState<Status>('idle');
  const [message, setMessage] = React.useState('');
  const [isRunning, setIsRunning] = React.useState(false);

  const handleRunCycle = async () => {
    if (!serverId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Server ID not found. Please sync with Discord first.',
      });
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/cron/shoutouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverId, force: true })
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message || 'Shoutout cycle completed successfully!');
        toast({
          title: 'Success!',
          description: 'Shoutouts have been generated and posted to Discord.',
        });
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to run shoutout cycle');
        toast({
          variant: 'destructive',
          title: 'Error',
          description: data.error || 'Failed to run shoutout cycle',
        });
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Network error');
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to connect to the server',
      });
    }

    // Reset status after 5 seconds
    setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 5000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Shoutout Automation
        </CardTitle>
        <CardDescription>
          Manually trigger a shoutout cycle or check automation status.
          Automated shoutouts run every 10 minutes via Cloud Scheduler.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {status !== 'idle' && (
          <Alert variant={status === 'error' ? 'destructive' : 'default'}>
            <AlertTitle>
              {status === 'loading' && 'Running...'}
              {status === 'success' && 'Success!'}
              {status === 'error' && 'Error'}
            </AlertTitle>
            <AlertDescription>
              {status === 'loading' && 'Generating shoutouts and posting to Discord...'}
              {status !== 'loading' && message}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Click the button below to manually trigger a shoutout cycle. This is useful for:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Testing the automation system</li>
            <li>Running shoutouts immediately without waiting</li>
            <li>Recovery if Cloud Scheduler failed</li>
          </ul>
        </div>

        <Button 
          onClick={handleRunCycle} 
          disabled={status === 'loading'}
          className="w-full"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Cycle...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Shoutout Cycle Now
            </>
          )}
        </Button>
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          💡 For 24/7 automation, set up Cloud Scheduler: <code className="bg-muted px-1 rounded">npm run setup:scheduler</code>
        </p>
      </CardFooter>
    </Card>
  );
}
