'use server';

import { ImageResponse } from '@vercel/og';
import { db } from '@/firebase/server-init';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
} from 'date-fns';
import { CalendarImageTemplate } from './calendar-image-template';
import type { CalendarEvent, UserProfile } from '@/lib/types';
import type { DocumentData } from 'firebase-admin/firestore';

async function fetchCalendarData(serverId: string, monthOffset: number = 0) {
  const today = new Date();
  const targetMonth = addMonths(startOfMonth(today), monthOffset);

  const viewStart = startOfWeek(startOfMonth(targetMonth));
  const viewEnd = endOfWeek(endOfMonth(targetMonth));

  const eventsSnapshot = await db
    .collection('servers')
    .doc(serverId)
    .collection('calendarEvents')
    .where('eventDateTime', '>=', viewStart)
    .where('eventDateTime', '<=', viewEnd)
    .orderBy('eventDateTime', 'asc')
    .get();

  const events = eventsSnapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      // Ensure eventDateTime is serializable
      eventDateTime: (data.eventDateTime.toDate as () => Date)().toISOString(),
    } as any;
  });

  const allUserIds = [
    ...new Set(events.map((e: CalendarEvent) => e.userId).filter(Boolean)),
  ];

  const userProfiles: Record<string, UserProfile> = {};
  if (allUserIds.length > 0) {
    const usersSnapshot = await db
      .collection('servers')
      .doc(serverId)
      .collection('users')
      .where('discordUserId', 'in', allUserIds)
      .get();
    usersSnapshot.forEach((doc) => {
      userProfiles[doc.id] = { id: doc.id, ...doc.data() } as UserProfile;
    });
  }

  return {
    events,
    userProfiles,
    targetMonth,
    today,
  };
}

export async function generateCalendarImage(
  guildId: string,
  monthOffset: number = 0
): Promise<string | null> {
  try {
    const { events, targetMonth, today } = await fetchCalendarData(
      guildId,
      monthOffset
    );

    const imageResponse = new ImageResponse(
      (
        <CalendarImageTemplate
          events={events}
          targetMonth={targetMonth}
          today={today}
        />
      ),
      {
        width: 600,
        height: 600,
      }
    );

    const imageBuffer = await imageResponse.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(imageBuffer).toString(
      'base64'
    )}`;
  } catch (error) {
    console.error(`[generateCalendarImage] Error using @vercel/og:`, error);
    // Fallback to a simple placeholder on error
    try {
      const response = await fetch('https://picsum.photos/seed/calendar-error/600/600');
      const buffer = await response.arrayBuffer();
      return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
    } catch (fallbackError) {
      console.error(`[generateCalendarImage] Fallback image failed:`, fallbackError);
      return null;
    }
  }
}
