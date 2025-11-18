import { db } from '@/firebase/server-init';
import { Timestamp } from 'firebase-admin/firestore';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { MissionCalendarCard, MissionLogCard } from '@/components/mission-calendar-ui';

export const dynamic = 'force-dynamic';

type CalendarEvent = {
  id: string;
  type?: string;
  username?: string;
  userAvatar?: string | null;
  userId?: string;
  eventName?: string;
  description?: string;
  eventDateTime?: Date | null;
};

type CaptainStat = {
  username: string;
  userAvatar?: string | null;
  count: number;
};

export default async function HeadlessCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ serverId: string }>;
  searchParams?: Promise<{ offset?: string }>;
}) {
  const { serverId } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const monthOffset = resolvedSearch?.offset ? parseInt(resolvedSearch.offset, 10) : 0;
  const today = new Date();
  const viewDate = addMonths(today, Number.isNaN(monthOffset) ? 0 : monthOffset);
  const month = startOfMonth(viewDate);
  const viewStart = startOfWeek(month, { weekStartsOn: 0 });
  const viewEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });

  let allEvents: CalendarEvent[] = [];
  let monthCaptains: CaptainStat[] = [];
  let todaysCaptain: CalendarEvent | null = null;
  let missionEvents: CalendarEvent[] = [];

  try {
    const eventsRef = db
      .collection('servers')
      .doc(serverId)
      .collection('calendarEvents');
    const snapshot = await eventsRef
      .where('eventDateTime', '>=', Timestamp.fromDate(viewStart))
      .where('eventDateTime', '<=', Timestamp.fromDate(viewEnd))
      .orderBy('eventDateTime', 'asc')
      .get();

    allEvents = snapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      const rawDate = data.eventDateTime;
      const eventDate =
        rawDate instanceof Timestamp
          ? rawDate.toDate()
          : rawDate instanceof Date
            ? rawDate
            : null;
      return {
        id: doc.id,
        ...data,
        eventDateTime: eventDate,
      } as CalendarEvent;
    });

    const captainLogs = allEvents.filter(
      (event) =>
        event.type === 'captains-log' &&
        event.eventDateTime &&
        isSameMonth(event.eventDateTime, month)
    );

    const captainCounts = captainLogs.reduce<Record<string, CaptainStat>>(
      (acc, log) => {
        const key = log.userId || log.username || log.id;
        if (!key) {
          return acc;
        }

        if (!acc[key]) {
          acc[key] = {
            username: log.username || 'Captain',
            userAvatar: log.userAvatar,
            count: 0,
          };
        }
        acc[key].count += 1;
        return acc;
      },
      {}
    );

    monthCaptains = Object.values(captainCounts).sort((a, b) => b.count - a.count);

    todaysCaptain =
      allEvents.find(
        (event) =>
          event.type === 'captains-log' &&
          event.eventDateTime &&
          isSameDay(event.eventDateTime, today)
      ) || null;

    missionEvents = allEvents.filter((event) => event.type !== 'captains-log');
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    missionEvents = missionEvents.filter((event) => {
      if (!event.eventDateTime) return true;
      const eventDate = new Date(event.eventDateTime);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= todayStart;
    });
  } catch (error) {
    console.error('[HeadlessCalendar] Failed to load events:', error);
  }

  return (
    <main className="w-[1280px] h-[660px] bg-blue-900 text-white rounded-3xl shadow-xl overflow-visible p-2.5">
      <div className="w-[1300px] h-full bg-gradient-to-br from-[#0d1c4d] via-[#0f245f] to-[#070c1f] rounded-2xl p-2.5">
        <div className="flex h-full">
        <div className="w-[620px] h-full flex flex-col">
          <MissionCalendarCard
          month={month}
          today={today}
          allEvents={allEvents}
          monthCaptains={monthCaptains}
            className="h-full flex-1"
          />
        </div>
        <div className="w-[620px] h-full">
          <MissionLogCard missionEvents={missionEvents} todaysCaptain={todaysCaptain} className="h-full" />
        </div>
      </div>
      </div>
    </main>
  );
}