'use server';

import { ImageResponse } from '@vercel/og';
import * as React from 'react';
import { db } from '@/firebase/server-init';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
} from 'date-fns';
import { CalendarImageTemplate } from './calendar-image-template';
import type { CalendarEvent } from '@/lib/types';

// Function to fetch font data
const getFontData = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.statusText}`);
    }
    return response.arrayBuffer();
};

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

  return {
    events,
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

    // Fetch fonts
    const ptSansRegular = await getFontData('https://fonts.gstatic.com/s/ptsans/v17/jizaRExUiTo99u79D0-ExdGM.ttf');
    const ptSansBold = await getFontData('https://fonts.gstatic.com/s/ptsans/v17/jizfRExUiTo99u79B_mh0O6i.ttf');


    const imageResponse = new ImageResponse(
      React.createElement(CalendarImageTemplate, {
        events: events,
        targetMonth: targetMonth,
        today: today,
      }),
      {
        width: 600,
        height: 600,
        fonts: [
          {
            name: 'Inter',
            data: ptSansRegular,
            weight: 400,
            style: 'normal',
          },
          {
            name: 'Inter',
            data: ptSansBold,
            weight: 700,
            style: 'normal',
          },
        ]
      }
    );

    const imageBuffer = await imageResponse.arrayBuffer();
    return `data:image/png;base64,${Buffer.from(imageBuffer).toString(
      'base64'
    )}`;
  } catch (error) {
    console.error(`[generateCalendarImage] Error using @vercel/og:`, error);
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
