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
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

interface ShoutoutLog {
  id: string;
  streamerName: string;
  createdAt: Timestamp;
  payload: {
    embeds?: {
      description?: string;
      footer?: {
        text?: string;
      };
    }[];
  };
}

function getGroupTypeFromFooter(footerText?: string): string {
  if (!footerText) return 'Community';
  const lowerText = footerText.toLowerCase();
  if (lowerText.includes('vip')) return 'VIP';
  if (lowerText.includes('raid train')) return 'Raid Train';
  if (lowerText.includes('fleet command')) return 'Raid Pile'; // for raid pile
  return 'Community';
}

export function RecentShoutouts() {
  const firestore = useFirestore();
  const [serverId, setServerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setServerId(localStorage.getItem('discordServerId'));
  }, []);

  const shoutoutLogsQuery = useMemoFirebase(() => {
    if (!firestore || !serverId) return null;
    return query(
      collection(firestore, 'servers', serverId, 'shoutoutLogs'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
  }, [firestore, serverId]);

  const { data: shoutouts, isLoading } = useCollection<ShoutoutLog>(shoutoutLogsQuery);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-headline">Recent Shoutouts</CardTitle>
        <CardDescription>
          A log of the latest generated shoutouts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
                <div className="flex justify-between">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-12 w-full" />
            </div>
          ))}

          {!isLoading && shoutouts && shoutouts.map((shoutout) => {
            const groupType = getGroupTypeFromFooter(shoutout.payload?.embeds?.[0]?.footer?.text);
            const message = shoutout.payload?.embeds?.[0]?.description || 'No description found.';
            return (
              <div key={shoutout.id} className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{shoutout.streamerName}</span>
                    <Badge
                      variant={
                        groupType === 'VIP'
                          ? 'default'
                          : groupType === 'Raid Train'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {groupType}
                    </Badge>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(shoutout.createdAt.toDate(), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-md">
                  {message}
                </p>
              </div>
            )
          })}
          {!isLoading && (!shoutouts || shoutouts.length === 0) && (
            <p className="text-center text-muted-foreground py-10">No recent shoutouts found.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
