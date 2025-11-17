'use server';

import puppeteer from 'puppeteer';
import { uploadGifFromUrl } from './firebase-storage-service';
import { convertClipToGif } from './gif-conversion-service';
import { manageUserClips, getRandomClipFromPool } from './clip-management-service';
import { DAILY_CLIP_LIMIT } from './clip-settings';

interface ShoutoutCardData {
  streamerName: string;
  streamTitle: string;
  gameName: string;
  viewerCount: number;
  avatarUrl: string;
  streamThumbnail: string;
  isLive: boolean;
  isMature?: boolean;
}

export async function generateShoutoutCardGif(
  cardData: ShoutoutCardData,
  serverId: string
): Promise<{ gifUrl: string; mp4Url: string } | null> {
  const { getMediaForUser } = await import('./media-fallback-service');
  const mediaUrl = await getMediaForUser({
    username: cardData.streamerName,
    mediaType: 'gif',
    contentType: 'vip', // VIP cards have the highest quality requirements
    serverId,
  });

  if (mediaUrl) {
    return { gifUrl: mediaUrl, mp4Url: mediaUrl.replace('.gif', '.mp4') };
  }
  
  console.error(`[ShoutoutCardService] All fallbacks failed for ${cardData.streamerName}`);
  return null;
}

async function updateGifRotation(serverId: string, streamerName: string, gifUrl: string, mp4Url: string): Promise<void> {
  try {
    const { db } = await import('@/firebase/server-init');
    const rotationRef = db.collection('servers').doc(serverId).collection('gifRotation').doc(`stream_${streamerName.toLowerCase()}`);
    const rotationDoc = await rotationRef.get();
    
    const now = new Date();
    
    if (!rotationDoc.exists) {
      // Start new session
      await rotationRef.set({
        sessionStart: now,
        lastGenerated: now,
        gifCount: 1,
        gifs: [{ gifUrl, mp4Url, createdAt: now }],
        streamerName
      });
      console.log(`[GifRotation] Started new session for ${streamerName} (1/6)`);
      return;
    }
    
    const data = rotationDoc.data();
    const sessionStart = data?.sessionStart?.toDate();
    const gifCount = data?.gifCount || 0;
    const gifs = data?.gifs || [];
    
    // Check if session is older than 24 hours
    if (sessionStart && (now.getTime() - sessionStart.getTime()) > (24 * 60 * 60 * 1000)) {
      // Start fresh session
      await rotationRef.set({
        sessionStart: now,
        lastGenerated: now,
        gifCount: 1,
        gifs: [{ gifUrl, mp4Url, createdAt: now }],
        streamerName
      });
      console.log(`[GifRotation] Started fresh session for ${streamerName} (1/6)`);
      return;
    }
    
    if (gifCount < 6) {
      // Add new GIF to collection
      const newGifs = [...gifs, { gifUrl, mp4Url, createdAt: now }];
      await rotationRef.update({
        lastGenerated: now,
        gifCount: gifCount + 1,
        gifs: newGifs
      });
      console.log(`[GifRotation] Added GIF ${gifCount + 1}/6 for ${streamerName}`);
    }
  } catch (error) {
    console.error('Error updating GIF rotation:', error);
  }
}
