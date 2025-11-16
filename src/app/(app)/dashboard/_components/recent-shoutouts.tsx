'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useFirestore, useCollection } from '@/firebase';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

type ShoutoutLog = {
  streamerName?: string | null
  channelId: string
  createdAt?: { toDate: () => Date }
  payload?: any
};

function extractDescription(payload: any): string {
  if (!payload || typeof payload !== 'object') {
    return 'Shoutout payload stored without preview data.';
  }
  if (typeof payload.description === 'string') {
    return payload.description;
  }
  if (Array.isArray(payload.embeds) && payload.embeds.length > 0) {
    const firstEmbed = payload.embeds[0];
    if (firstEmbed?.description) {
      return firstEmbed.description;
    }
  }
  if (typeof payload.content === 'string' && payload.content.length > 0) {
    return payload.content;
  }
  return 'Shoutout sent successfully.';
}

export function RecentShoutouts() {
  const firestore = useFirestore();
  const [serverId, setServerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setServerId(localStorage.getItem('discordServerId'));
  }, []);

  const shoutoutsQuery = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return query(
      collection(firestore, 'servers', serverId, 'shoutoutLogs'),
      orderBy('createdAt', 'desc'),
      limit(5),
    );
  }, [firestore, serverId]);

  const { data: shoutouts, isLoading } = useCollection<ShoutoutLog>(shoutoutsQuery);

  const emptyState = !isLoading && (!shoutouts || shoutouts.length === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-headline">Recent Shoutouts</CardTitle>
        <CardDescription>
          A log of the latest shoutouts delivered to Discord.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {isLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          {emptyState && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No shoutouts have been posted yet. Generate one from the Shoutouts page.
            </p>
          )}
          {!isLoading &&
            shoutouts?.map((shoutout, index) => {
              const description = extractDescription(shoutout.payload);
              const createdAt = shoutout.createdAt?.toDate();
              return (
                <div key={index} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        {shoutout.streamerName || 'Unknown Streamer'}
                      </span>
                      <Badge variant="secondary">Shoutout</Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {createdAt
                        ? formatDistanceToNow(createdAt, { addSuffix: true })
                        : 'Just now'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
                    {description}
                  </p>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

