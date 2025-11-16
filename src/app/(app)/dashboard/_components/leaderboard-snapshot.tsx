'use client';

import * as React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, Trophy } from 'lucide-react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, doc, getDoc, limit, orderBy, query } from 'firebase/firestore';
import type { LeaderboardEntry, UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

type RankedEntry = LeaderboardEntry & { rank: number; profile?: UserProfile | null };

export function LeaderboardSnapshot() {
  const firestore = useFirestore();
  const [serverId, setServerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setServerId(localStorage.getItem('discordServerId'));
  }, []);

  const leaderboardQuery = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return query(
      collection(firestore, 'servers', serverId, 'leaderboard'),
      orderBy('points', 'desc'),
      limit(3),
    );
  }, [firestore, serverId]);

  const { data: entries, isLoading } = useCollection<LeaderboardEntry>(leaderboardQuery);
  const [rankedEntries, setRankedEntries] = React.useState<RankedEntry[]>([]);

  React.useEffect(() => {
    if (!firestore || !serverId || !entries) {
      setRankedEntries([]);
      return;
    }

    let cancelled = false;
    const loadProfiles = async () => {
      const results: RankedEntry[] = [];
      let rank = 1;

      for (const entry of entries) {
        let profile: UserProfile | null = null;
        try {
          const userDoc = await getDoc(
            doc(firestore, 'servers', serverId, 'users', entry.userProfileId),
          );
          if (userDoc.exists()) {
            profile = userDoc.data() as UserProfile;
          }
        } catch (error) {
          console.warn('Failed to load user profile for leaderboard entry', error);
        }
        results.push({ ...entry, rank, profile });
        rank += 1;
      }

      if (!cancelled) {
        setRankedEntries(results);
      }
    };

    loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [entries, firestore, serverId]);

  const emptyState = !isLoading && rankedEntries.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl font-headline">Leaderboard</CardTitle>
          <CardDescription>Top community contributors.</CardDescription>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href="/leaderboard">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        )}
        {emptyState && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No leaderboard data yet. Once points are awarded, top members will appear here.
          </p>
        )}
        {!isLoading && rankedEntries.length > 0 && (
          <div className="space-y-4">
            {rankedEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                  {entry.rank <= 3 ? (
                    <Trophy
                      className="h-5 w-5"
                      style={{
                        color:
                          entry.rank === 1
                            ? '#facc15'
                            : entry.rank === 2
                            ? '#94a3b8'
                            : '#f97316',
                      }}
                    />
                  ) : (
                    <span className="font-semibold">{entry.rank}</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={entry.profile?.avatarUrl} alt={entry.profile?.username ?? 'User'} />
                    <AvatarFallback>
                      {entry.profile?.username?.charAt(0) ?? entry.userProfileId.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{entry.profile?.username ?? entry.userProfileId}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.profile ? `@${entry.profile.discordUserId}` : 'No profile data'}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-sm text-muted-foreground">
                  {entry.points.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

