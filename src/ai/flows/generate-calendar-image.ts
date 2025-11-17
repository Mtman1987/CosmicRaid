'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a calendar image.
 * This now uses a robust screenshot service with fallbacks.
 *
 * - generateCalendarImage - A function that returns a base64 encoded PNG of the calendar.
 */

import { takeScreenshot } from '@/lib/screenshot-service';

export async function generateCalendarImage(
  guildId: string,
  monthOffset = 0
): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const screenshotUrl = `${appUrl}/headless/calendar/${guildId}?offset=${monthOffset}`;
  const fileName = `calendar-images/${guildId}/calendar-${Date.now()}.png`;
  const viewport = { width: 620, height: 660, deviceScaleFactor: 1.5 };

  console.log(`[generateCalendarImage] Requesting screenshot of ${screenshotUrl}`);
  const imageUrl = await takeScreenshot(screenshotUrl, fileName, viewport);

  if (imageUrl) {
    console.log(`[generateCalendarImage] Screenshot successful, URL: ${imageUrl}`);
  } else {
    console.error(`[generateCalendarImage] Failed to generate calendar image for ${guildId}.`);
  }

  return imageUrl;
}
