'use server';

import { ImageResponse } from '@vercel/og';
import * as React from 'react';
import { db } from '@/firebase/server-init';
import { LeaderboardImageTemplate } from '@/app/headless/leaderboard-image-template';
import type { UserProfile, LeaderboardEntry } from '@/lib/types';

// Function to fetch font data
const getFontData = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch font: ${response.statusText}`);
    }
    return response.arrayBuffer();
};

async function fetchLeaderboardData(serverId: string, limit: number = 10) {
  const leaderboardSnapshot = await db
    .collection('servers')
    .doc(serverId)
    .collection('leaderboard')
    .orderBy('points', 'desc')
    .limit(limit)
    .get();

  const entries: any[] = leaderboardSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const userIds = entries.map((e) => e.userProfileId).filter(Boolean);
  if (userIds.length === 0) return [];

  const usersSnapshot = await db
    .collection('servers')
    .doc(serverId)
    .collection('users')
    .where('discordUserId', 'in', userIds)
    .get();
  
  const userProfiles: Record<string, UserProfile> = {};
  usersSnapshot.forEach((doc) => {
    userProfiles[doc.data().discordUserId] = { id: doc.id, ...doc.data() } as UserProfile;
  });

  const formattedEntries = entries.map((entry, index) => {
    const user = userProfiles[entry.userProfileId];
    return {
      rank: index + 1,
      username: user?.username || 'Unknown User',
      avatarUrl: user?.avatarUrl || 'https://placehold.co/128x128/374151/a0aec0.png?text=?',
      points: entry.points || 0,
    };
  });

  return formattedEntries;
}

export async function generateLeaderboardImage(
  guildId: string,
): Promise<string | null> {
  try {
    const leaderboardEntries = await fetchLeaderboardData(guildId);

    // Fetch fonts
    const ptSansRegular = await getFontData('https://fonts.gstatic.com/s/ptsans/v17/jizaRExUiTo99u79D0-ExdGM.ttf');
    const ptSansBold = await getFontData('https://fonts.gstatic.com/s/ptsans/v17/jizfRExUiTo99u79B_mh0O6i.ttf');

    const imageResponse = new ImageResponse(
      React.createElement(LeaderboardImageTemplate, {
        entries: leaderboardEntries,
      }),
      {
        width: 600,
        height: 800,
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
    console.error(`[generateLeaderboardImage] Error using @vercel/og:`, error);
    try {
      const response = await fetch('https://picsum.photos/seed/leaderboard-error/600/800');
      const buffer = await response.arrayBuffer();
      return `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
    } catch (fallbackError) {
      console.error(`[generateLeaderboardImage] Fallback image failed:`, fallbackError);
      return null;
    }
  }
}
