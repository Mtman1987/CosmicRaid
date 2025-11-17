'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function UptimeMonitorCard() {
  const statusPageUrl = 'https://stats.uptimerobot.com/5NVFMzNKQZ';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Uptime Monitor
        </CardTitle>
        <CardDescription>
          Real-time status of automated shoutout system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-muted/50 overflow-hidden">
          <iframe
            src={statusPageUrl}
            className="w-full h-[400px] border-0"
            title="Uptime Robot Status"
            loading="lazy"
          />
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => window.open(statusPageUrl, '_blank')}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Open Full Status Page
        </Button>
      </CardContent>
    </Card>
  );
}
