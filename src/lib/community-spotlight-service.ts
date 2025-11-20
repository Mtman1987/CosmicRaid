'use server';

import { db } from '@/firebase/server-init';
import { getUserByLogin, getStreamByUserId } from './twitch-api-service';
import { generateShoutoutCardGif } from './shoutout-card-service';
import { manageUserClips, getRandomClipFromPool } from './clip-management-service';
import { isCommunityGroupSync } from './group-utils';

// Internal constants - not exported
const MIN_SPOTLIGHT_DURATION_MS = 2 * 60 * 1000;
const MAX_SPOTLIGHT_DURATION_MS = 10 * 60 * 1000;

// Internal helper function - not exported
function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// Internal interface - not exported
interface SpotlightData {
  streamerName: string;
  cardGifUrl: string;
  mp4Url?: string;
  lastUpdated: string;
  streamData: {
    title: string;
    game: string;
    viewers: number;
    avatarUrl: string;
    isMature?: boolean;
  };
}

export async function updateCommunitySpotlight(serverId: string): Promise<void> {
  try {
    // Get all online community members
    const usersRef = db.collection('servers').doc(serverId).collection('users');
    const snapshot = await usersRef
      .where('isOnline', '==', true)
      .get();

    const communityDocs = snapshot.docs.filter(doc => isCommunityGroupSync(doc.data().group));
    const onlineMembers = communityDocs
      .map(doc => ({
        userId: doc.id,
        username: doc.data().username as string | undefined,
      }))
      .filter(member => Boolean(member.username)) as { userId: string; username: string }[];

    // Get current spotlight reference first
    const spotlightRef = db.collection('servers').doc(serverId).collection('spotlight').doc('current');
    
    if (onlineMembers.length === 0) {
      console.log('No online community members, trying cached clips');
      
      // Get all community members with cached clips
      const allUsersSnapshot = await usersRef.get();
      const communityMembersWithClips = [];
      
      for (const doc of allUsersSnapshot.docs) {
        const userData = doc.data();
        if (isCommunityGroupSync(userData.group) && userData.dailyClips && userData.dailyClips.length > 0) {
          communityMembersWithClips.push({
            userId: doc.id,
            username: userData.username,
            clips: userData.dailyClips
          });
        }
      }
      
      if (communityMembersWithClips.length === 0) {
        console.log('No community members with cached clips');
        return;
      }
      
      // Pick a random member and clip
      const randomMember = communityMembersWithClips[Math.floor(Math.random() * communityMembersWithClips.length)];
      const randomClip = randomMember.clips[Math.floor(Math.random() * randomMember.clips.length)];
      
      const newSpotlightData: SpotlightData = {
        streamerName: randomMember.username,
        cardGifUrl: randomClip.gifUrl,
        mp4Url: randomClip.mp4Url,
        lastUpdated: new Date().toISOString(),
        streamData: {
          title: randomClip.streamTitle || 'Previous Stream',
          game: randomClip.gameName || 'Just Chatting',
          viewers: 0,
          avatarUrl: 'https://static-cdn.jtvnw.net/jtv_user_pictures/default_profile_image-300x300.png'
        }
      };
      
      await spotlightRef.set(newSpotlightData, { merge: true });
      console.log(`Created spotlight from cached clip: ${randomMember.username}`);
      return;
    }

    // Get current spotlight
    const currentSpotlight = await spotlightRef.get();
    const currentData = currentSpotlight.exists ? currentSpotlight.data() as SpotlightData : null;

    const now = Date.now();
    const lastUpdatedDate = toDate(currentData?.lastUpdated);

    // Get list of online streamers
    // Find next streamer (rotate from current)
    let nextIndex = 0;
    if (currentData?.streamerName) {
      const currentIndex = onlineMembers.findIndex(member => member.username === currentData.streamerName);
      if (currentIndex !== -1 && currentIndex < onlineMembers.length - 1) {
        nextIndex = currentIndex + 1;
      }
    }
    const nextMember = onlineMembers[nextIndex];
    const nextStreamer = nextMember.username;

    if (currentData?.streamerName === nextStreamer && lastUpdatedDate) {
      const elapsed = now - lastUpdatedDate.getTime();
      if (elapsed < MIN_SPOTLIGHT_DURATION_MS) {
        console.log(`[Spotlight] Keeping ${nextStreamer} active for at least 2 minutes`);
        return;
      }
      if (elapsed < MAX_SPOTLIGHT_DURATION_MS && onlineMembers.length <= 1) {
        console.log(`[Spotlight] ${nextStreamer} remains spotlighted (only community member live)`);
        return;
      }
    }

    // Get Twitch data for next streamer
    const twitchUser = await getUserByLogin(nextStreamer.toLowerCase());
    if (!twitchUser) {
      console.log(`Twitch user ${nextStreamer} not found`);
      return;
    }

    const stream = await getStreamByUserId(twitchUser.id);
    if (!stream) {
      console.log(`${nextStreamer} is not live`);
      return;
    }

    let cardGifUrl = null;
    let mp4Url = null;

    const userLookup = { userId: nextMember.userId, username: nextStreamer };

    const cachedClip = await getRandomClipFromPool(serverId, userLookup);
    if (cachedClip) {
      cardGifUrl = cachedClip.gifUrl;
      mp4Url = cachedClip.mp4Url;
      console.log(`[Spotlight] Using cached clip for ${nextStreamer}`);
    } else {
      const cardResult = await generateShoutoutCardGif(nextStreamer, serverId);
      
      if (cardResult) {
        cardGifUrl = cardResult;
        mp4Url = null; // Not available from this function
        
        // Clip management simplified since we only have GIF URL
      }
    }
    
    if (!cardGifUrl) {
      console.log(`Failed to get card for ${nextStreamer}`);
      return;
    }

    // Update spotlight
    const newSpotlightData: SpotlightData = {
      streamerName: nextStreamer,
      cardGifUrl: cardGifUrl,
      mp4Url: mp4Url || undefined,
      lastUpdated: new Date().toISOString(),
      streamData: {
        title: stream.title,
        game: stream.game_name || 'Just Chatting',
        viewers: stream.viewer_count,
        avatarUrl: twitchUser.profile_image_url,
        isMature: Boolean(stream.is_mature)
      }
    };

    await spotlightRef.set(newSpotlightData, { merge: true });
    console.log(`Updated community spotlight to ${nextStreamer}`);

  } catch (error) {
    console.error('Error updating community spotlight:', error);
  }
}

export async function getCurrentSpotlight(serverId: string): Promise<SpotlightData | null> {
  try {
    const spotlightRef = db.collection('servers').doc(serverId).collection('spotlight').doc('current');
    const doc = await spotlightRef.get();
    
    if (!doc.exists) {
      return null;
    }

    return doc.data() as SpotlightData;
  } catch (error) {
    console.error('Error getting current spotlight:', error);
    return null;
  }
}
