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
import { ArrowRight, Calendar, Users, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { CalendarEvent } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<string, React.ReactNode> = {
  event: <Users className="h-4 w-4 text-muted-foreground" />,
  meeting: <Calendar className="h-4 w-4 text-muted-foreground" />,
  qotd: <Megaphone className="h-4 w-4 text-muted-foreground" />,
};

export function UpcomingEvents() {
  const firestore = useFirestore();
  const [serverId, setServerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setServerId(localStorage.getItem('discordServerId'));
  }, []);

  const now = React.useMemo(() => new Date(), []);

  const eventsQuery = useMemoFirebase(() => {
    if (!firestore || !serverId) return null;
    return query(
        collection(firestore, 'servers', serverId, 'calendarEvents'),
        where('eventDateTime', '>=', now),
        where('type', '!=', 'captains-log'),
        orderBy('eventDateTime', 'asc'),
        limit(3)
    );
  }, [firestore, serverId, now]);

  const { data: upcomingEvents, isLoading } = useCollection<CalendarEvent>(eventsQuery);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl font-headline">Upcoming Events</CardTitle>
          <CardDescription>What's next on the schedule.</CardDescription>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href="/calendar">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading && Array.from({ length: 3 }).map((_, i) => (
             <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
          {!isLoading && upcomingEvents && upcomingEvents.map((event) => (
            <div key={event.id} className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                {iconMap[event.type] || <Calendar className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <p className="font-medium">{event.eventName}</p>
                <p className="text-sm text-muted-foreground">
                  {format(event.eventDateTime.toDate(), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          ))}
           {!isLoading && (!upcomingEvents || upcomingEvents.length === 0) && (
             <p className="text-center text-muted-foreground py-6">No upcoming events scheduled.</p>
           )}
        </div>
      </CardContent>
    </Card>
  );
}
