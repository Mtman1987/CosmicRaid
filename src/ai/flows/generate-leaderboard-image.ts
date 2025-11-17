'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a leaderboard image.
 * This now uses a robust screenshot service with fallbacks.
 *
 * - generateLeaderboardImage - A function that returns a base64 encoded PNG of the leaderboard.
 */

import { takeScreenshot } from '@/lib/screenshot-service';

export async function generateLeaderboardImage(
  guildId: string
): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const screenshotUrl = `${appUrl}/headless/leaderboard/${guildId}`;
  const fileName = `leaderboard-images/${guildId}/leaderboard-${Date.now()}.png`;
  const viewport = { width: 600, height: 800, deviceScaleFactor: 1.5 };

  console.log(`[generateLeaderboardImage] Requesting screenshot of ${screenshotUrl}`);
  const imageUrl = await takeScreenshot(screenshotUrl, fileName, viewport);

  if (imageUrl) {
    console.log(`[generateLeaderboardImage] Screenshot successful, URL: ${imageUrl}`);
  } else {
    console.error(`[generateLeaderboardImage] Failed to generate leaderboard image for ${guildId}.`);
  }

  return imageUrl;
}
