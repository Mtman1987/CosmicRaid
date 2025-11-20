'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Zap, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CronStatus {
  success: boolean;
  serversProcessed: number;
  totalUsers: number;
  apiCalls: number;
  errors: string[];
}

export function TwitchPollingSettings() {
  const [cronStatus, setCronStatus] = React.useState<CronStatus | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const { toast } = useToast();

  const runCronCycle = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cron/status', { method: 'POST' });
      const result = await response.json();
      
      setCronStatus(result);
      
      if (result.success) {
        toast({
          title: 'Cron Cycle Complete',
          description: `Processed ${result.serversProcessed} servers, ${result.totalUsers} users with ${result.apiCalls} API calls`,
        });
      } else {
        toast({
          title: 'Cron Cycle Issues',
          description: `${result.errors.length} errors occurred`,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to run cron cycle',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Unified Cron Service
            </CardTitle>
            <CardDescription>
              Automated Twitch monitoring, shoutout generation, and Discord posting
            </CardDescription>
          </div>
          <Badge variant={cronStatus?.success ? 'default' : cronStatus ? 'destructive' : 'secondary'}>
            {cronStatus?.success ? 'Healthy' : cronStatus ? 'Issues' : 'Unknown'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {cronStatus && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{cronStatus.serversProcessed}</div>
              <div className="text-xs text-muted-foreground">Servers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{cronStatus.totalUsers}</div>
              <div className="text-xs text-muted-foreground">Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{cronStatus.apiCalls}</div>
              <div className="text-xs text-muted-foreground">API Calls</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold flex items-center justify-center gap-1">
                {cronStatus.success ? (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </div>
              <div className="text-xs text-muted-foreground">Status</div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Manual Actions</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={runCronCycle}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Run Cron Cycle
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            <strong>Automatic:</strong> Cron runs every 10 minutes via Firebase Functions. Use manual run to test or force immediate execution.
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-medium">Unified Cron Operations</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Batch Twitch API calls across all servers for efficiency</li>
            <li>• Updates online/offline status for all users</li>
            <li>• Generates shoutouts for Community, VIP, and Spotlight</li>
            <li>• Posts shoutouts and community spotlight to Discord</li>
            <li>• Cleans up old clips (10% chance per run)</li>
          </ul>
        </div>

        {cronStatus?.errors && cronStatus.errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-red-600">Recent Errors</h4>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {cronStatus.errors.map((error, i) => (
                <div key={i} className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}