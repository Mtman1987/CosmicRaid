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
import { useFirestore, useCollection } from '@/firebase';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import type { CalendarEvent } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const iconMap: Record<CalendarEvent['type'], React.ReactNode> = {
  event: <Users className="h-4 w-4 text-muted-foreground" />,
  meeting: <Calendar className="h-4 w-4 text-muted-foreground" />,
  qotd: <Megaphone className="h-4 w-4 text-muted-foreground" />,
  'captains-log': <Megaphone className="h-4 w-4 text-muted-foreground" />,
};

export function UpcomingEvents() {
  const firestore = useFirestore();
  const [serverId, setServerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setServerId(localStorage.getItem('discordServerId'));
  }, []);

  const eventsQuery = React.useMemo(() => {
    if (!firestore || !serverId) return null;
    return query(
      collection(firestore, 'servers', serverId, 'calendarEvents'),
      orderBy('eventDateTime'),
      limit(6),
    );
  }, [firestore, serverId]);

  const { data: events, isLoading } = useCollection<CalendarEvent>(eventsQuery);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    setNow(Date.now());
  }, [events]);

  const upcomingEvents = React.useMemo(() => {
    if (!events) return [];
    return events
      .filter((event) => event.eventDateTime)
      .map((event) => ({
        ...event,
        date: event.eventDateTime.toDate(),
      }))
      .filter((event) => event.date.getTime() >= now)
      .slice(0, 3);
  }, [events, now]);

  const showEmptyState = !isLoading && upcomingEvents.length === 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-xl font-headline">Upcoming Events</CardTitle>
          <CardDescription>What&apos;s next on the schedule.</CardDescription>
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
          {isLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          {showEmptyState && (
            <p className="text-sm text-muted-foreground text-center py-6">
              No upcoming events on the calendar yet. Add one from the calendar page.
            </p>
          )}
          {!isLoading &&
            upcomingEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  {iconMap[event.type] ?? (
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium">{event.eventName}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(event.date, 'MMM d, yyyy • h:mm a')}
                  </p>
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}
