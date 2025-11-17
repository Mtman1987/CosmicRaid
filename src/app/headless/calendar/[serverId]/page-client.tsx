'use client';

import * as React from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import { addMonths } from 'date-fns';
import { FirebaseComponentsProvider } from '@/firebase';
import {
  MissionCalendarCard,
  MissionLogCard,
} from '@/components/mission-calendar-ui';

// This is a special, unlisted page used only for taking screenshots.
// It renders the core CalendarDisplay component without any site layout.
// We wrap it in the Firebase provider so it can fetch its own data.
export default function HeadlessCalendarClientPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const serverId = params.serverId as string;
  const offset = searchParams.get('offset');
  const monthOffset = offset ? parseInt(offset, 10) : 0;
  const today = React.useMemo(() => new Date(), []);
  const month = React.useMemo(
    () => addMonths(today, Number.isNaN(monthOffset) ? 0 : monthOffset),
    [today, monthOffset]
  );

  // This component will now need to fetch its own data since it's a client component.
  // For the purpose of screenshotting, we can pass placeholder/empty data
  // as the actual data fetching is handled within the components themselves.

  return (
    <FirebaseComponentsProvider>
      <main className="w-[620px] h-[660px] bg-blue-900 text-white rounded-3xl shadow-xl overflow-hidden p-2.5">
        <div className="flex flex-col gap-2.5 h-full">
          <MissionCalendarCard
            month={month}
            today={today}
            allEvents={[]}
            monthCaptains={[]}
          />
          <MissionLogCard missionEvents={[]} todaysCaptain={null} />
        </div>
      </main>
    </FirebaseComponentsProvider>
  );
}
