'use server';

import { db } from '@/firebase/server-init';
import { getUserByLogin, getStreamByUserId } from './twitch-api-service';
import { generateShoutoutCardGif } from './shoutout-card-service';
import { isVipGroupSync } from './group-utils';

export async function updateVipAnimatedCards(serverId: string): Promise<void> {
  try {
    const usersSnapshot = await db
      .collection('servers')
      .doc(serverId)
      .collection('users')
      .where('isOnline', '==', true)
      .get();

    if (usersSnapshot.empty) {
      console.log('[VipAnimatedCards] No online users found');
      return;
    }

    for (const doc of usersSnapshot.docs) {
      const userData = doc.data();
      if (!isVipGroupSync(userData?.group)) {
        continue;
      }

      await updateVipAnimatedCard(serverId, doc.id, userData);
    }
  } catch (error) {
    console.error('[VipAnimatedCards] Failed to update VIP animated cards:', error);
  }
}

async function updateVipAnimatedCard(serverId: string, userId: string, userData: any): Promise<void> {
  const streamerName = userData?.username;
  if (!streamerName) return;

  try {
    const twitchUser = await getUserByLogin(streamerName.toLowerCase());
    if (!twitchUser) return;

    const stream = await getStreamByUserId(twitchUser.id);
    if (!stream) return;

    const cardResult = await generateShoutoutCardGif({
      streamerName,
      streamTitle: stream.title || 'Live Stream',
      gameName: stream.game_name || 'Just Chatting',
      viewerCount: stream.viewer_count || 0,
      avatarUrl: twitchUser.profile_image_url || '',
      streamThumbnail: stream.thumbnail_url?.replace('{width}', '640').replace('{height}', '360') || '',
      isLive: true,
      isMature: Boolean(stream.is_mature)
    }, serverId);

    if (cardResult) {
      await db.collection('servers').doc(serverId).collection('users').doc(userId).update({
        vipAnimatedCard: {
          gifUrl: cardResult.gifUrl,
          mp4Url: cardResult.mp4Url,
          lastUpdated: new Date().toISOString()
        }
      });
      console.log(`[VipAnimatedCards] Updated animated card for ${streamerName}`);
    }
  } catch (error) {
    console.error(`[VipAnimatedCards] Error updating ${streamerName}:`, error);
  }
}
