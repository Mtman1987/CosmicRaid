'use server';

import { db } from '@/firebase/server-init';
import { checkMultipleStreamsStatus, getUserByLogin, getClipsForUser, getRandomClipFromOnlineUsers } from './twitch-api-service';
import { convertClipToGif } from './gif-conversion-service';
import { isCommunityGroupSync, isVipGroupSync } from './group-utils';
import { runAutomatedShoutoutCycle } from './automated-shoutout-system';

interface CachedClip {
  clipId: string;
  clipUrl: string;
  gifUrl: string; // Now points to Firebase Storage URL
  firebaseFileName?: string; // Track Firebase Storage file name
  streamerName: string;
  title: string;
  createdAt: string;
  cachedAt: string;
}

class PollingService {
  private isPolling = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private readonly POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (reduced API calls)
  private readonly GIF_CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

  async startPolling(serverId: string): Promise<void> {
    if (this.isPolling) {
      console.log('Polling already active');
      return;
    }

    this.isPolling = true;
    console.log('Starting Twitch polling service...');

    // Initial poll
    await this.pollTwitchData(serverId);

    // Set up interval
    this.pollInterval = setInterval(async () => {
      try {
        await this.pollTwitchData(serverId);
      } catch (error) {
        console.error('Error in polling interval:', error);
      }
    }, this.POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log('Stopped Twitch polling service');
  }

  private async pollTwitchData(serverId: string): Promise<void> {
    try {
      console.log('Polling Twitch data...');

      // Get all users from Firestore
      const usersSnapshot = await db
        .collection('servers')
        .doc(serverId)
        .collection('users')
        .get();

      if (usersSnapshot.empty) {
        console.log('No users found to poll');
        return;
      }

      // Extract Twitch usernames (assuming username is their Twitch login)
      const twitchUsernames: string[] = [];
      const userDocs: { [username: string]: any } = {};

      usersSnapshot.docs.forEach(doc => {
        const userData = doc.data();
        if (userData.username && typeof userData.username === 'string' && userData.username.trim().length > 0) {
          const cleanUsername = userData.username.toLowerCase().trim();
          // Filter out invalid usernames and reserved names
          const reservedNames = ['cosmo', 'dyno', 'translator', 'patchbot', 'xenon'];
          if (/^[a-zA-Z0-9_]{4,25}$/.test(cleanUsername) && 
              !cleanUsername.includes('__') && 
              !reservedNames.includes(cleanUsername) &&
              !cleanUsername.startsWith('_') &&
              !cleanUsername.endsWith('_')) {
            twitchUsernames.push(cleanUsername);
            userDocs[cleanUsername] = { id: doc.id, data: userData };
          }
        }
      });

      if (twitchUsernames.length === 0) {
        console.log('No Twitch usernames found');
        return;
      }

      console.log(`Checking stream status for ${twitchUsernames.length} users`);
      // Check stream status for all users
      const streamStatusMap = await checkMultipleStreamsStatus(twitchUsernames);

      // Update online status in Firestore
      const batch = db.batch();
      let updatedCount = 0;
      let onlineUsers = [];

      for (const [username, isOnline] of streamStatusMap.entries()) {
        const userDoc = userDocs[username];
        if (userDoc) {
          if (isOnline) {
            onlineUsers.push(`${username} (${userDoc.data.group || 'no group'})`);
          }
          if (userDoc.data.isOnline !== isOnline) {
            const userRef = db
              .collection('servers')
              .doc(serverId)
              .collection('users')
              .doc(userDoc.id);

            batch.update(userRef, {
              isOnline,
              lastStatusUpdate: new Date(),
            });
            updatedCount++;
          }
        }
      }
      
      if (onlineUsers.length > 0) {
        console.log(`Online users: ${onlineUsers.join(', ')}`);
      }

      if (updatedCount > 0) {
        await batch.commit();
        console.log(`Updated online status for ${updatedCount} users`);
      } else {
        console.log('No status changes detected');
      }

      // Update community spotlight rotation and regenerate all shoutouts
      const { updateCommunitySpotlight } = await import('./community-spotlight-service');
      const { generateAllShoutouts } = await import('./community-shoutout-service');
      const { postAllShoutoutsToDiscord } = await import('./automated-shoutout-system');
      
      await updateCommunitySpotlight(serverId);
      await generateAllShoutouts(serverId);
      await postAllShoutoutsToDiscord(serverId);
      console.log('Regenerated all shoutouts and posted to Discord');

    } catch (error) {
      console.error('Error polling Twitch data:', error);
    }
  }

  private async updateGifCache(serverId: string, streamStatusMap: Map<string, boolean>): Promise<void> {
    try {
      // Get cached clips
      const cacheRef = db.collection('servers').doc(serverId).collection('clipCache');
      const cacheSnapshot = await cacheRef.get();
      
      const existingCache = new Map<string, CachedClip>();
      cacheSnapshot.docs.forEach(doc => {
        const data = doc.data() as CachedClip;
        existingCache.set(data.streamerName, data);
      });

      // Get online streamers
      const onlineStreamers = Array.from(streamStatusMap.entries())
        .filter(([_, isOnline]) => isOnline)
        .map(([username, _]) => username);

      if (onlineStreamers.length === 0) {
        console.log('No online streamers to update GIF cache for');
        return;
      }

      // Update cache for VIP users who are online
      const vipUsersSnapshot = await db
        .collection('servers')
        .doc(serverId)
        .collection('users')
        .where('isOnline', '==', true)
        .get();

      const vipDocs = vipUsersSnapshot.docs.filter(doc => isVipGroupSync(doc.data().group));

      for (const doc of vipDocs) {
        const userData = doc.data();
        const username = userData.username?.toLowerCase();
        
        if (!username) continue;

        const cached = existingCache.get(username);
        const needsUpdate = !cached || 
          (Date.now() - new Date(cached.cachedAt).getTime()) > this.GIF_CACHE_DURATION_MS;

        if (needsUpdate) {
          await this.updateClipGifForUser(serverId, username, userData.username);
        }
      }

      // Update community spotlight cache
      await this.updateCommunitySpotlightCache(serverId, onlineStreamers);

    } catch (error) {
      console.error('Error updating GIF cache:', error);
    }
  }

  private async updateClipGifForUser(serverId: string, username: string, displayName: string): Promise<void> {
    try {
      console.log(`Updating GIF cache for ${displayName}...`);

      // Get user info from Twitch
      const twitchUser = await getUserByLogin(username);
      if (!twitchUser) {
        console.log(`Twitch user ${username} not found`);
        return;
      }

      // Get recent clips
      const clips = await getClipsForUser(twitchUser.id, 5);
      if (clips.length === 0) {
        console.log(`No clips found for ${displayName}`);
        return;
      }

      // Pick the most viewed clip
      const bestClip = clips.reduce((prev, current) => 
        current.view_count > prev.view_count ? current : prev
      );

      // Convert to GIF and save to Firebase Storage
      let gifUrl = await convertClipToGif(
        bestClip.url,
        bestClip.id,
        displayName,
        bestClip.duration,
        'stream',
        { serverId }
      );
      
      // Fallback to thumbnail if conversion fails
      if (!gifUrl) {
        console.log(`GIF conversion failed for ${displayName}, using thumbnail`);
        gifUrl = await getThumbnailAsGif(bestClip.thumbnail_url);
      }

      // Save to cache
      const { generateFileName } = await import('./firebase-storage-service');
      const cacheData: CachedClip = {
        clipId: bestClip.id,
        clipUrl: bestClip.url,
        gifUrl,
        firebaseFileName: await generateFileName(bestClip.id, displayName),
        streamerName: username,
        title: bestClip.title,
        createdAt: bestClip.created_at,
        cachedAt: new Date().toISOString(),
      };

      await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .doc(username)
        .set(cacheData);

      console.log(`Updated GIF cache for ${displayName}`);

    } catch (error) {
      console.error(`Error updating GIF cache for ${displayName}:`, error);
    }
  }

  private async updateCommunitySpotlightCache(serverId: string, onlineStreamers: string[]): Promise<void> {
    try {
      // Get a random clip from online community members
      const communityUsersSnapshot = await db
        .collection('servers')
        .doc(serverId)
        .collection('users')
        .where('isOnline', '==', true)
        .get();

      const onlineCommunityUsers = communityUsersSnapshot.docs
        .filter(doc => isCommunityGroupSync(doc.data().group))
        .map(doc => doc.data().username?.toLowerCase())
        .filter(username => username && onlineStreamers.includes(username));

      if (onlineCommunityUsers.length === 0) {
        console.log('No online community members for spotlight');
        return;
      }

      // Get a random clip from online community members
      const randomClip = await getRandomClipFromOnlineUsers(onlineCommunityUsers);
      
      if (!randomClip) {
        console.log('No clips found for community spotlight');
        return;
      }

      // Convert to GIF and save to Firebase Storage
      let gifUrl = await convertClipToGif(
        randomClip.url,
        randomClip.id,
        randomClip.broadcaster_name,
        randomClip.duration,
        'stream',
        { serverId }
      );
      
      if (!gifUrl) {
        gifUrl = await getThumbnailAsGif(randomClip.thumbnail_url);
      }

      // Save community spotlight cache
      const { generateFileName } = await import('./firebase-storage-service');
      const spotlightData = {
        clipId: randomClip.id,
        clipUrl: randomClip.url,
        gifUrl,
        firebaseFileName: await generateFileName(randomClip.id, randomClip.broadcaster_name),
        streamerName: randomClip.broadcaster_name,
        title: randomClip.title,
        createdAt: randomClip.created_at,
        cachedAt: new Date().toISOString(),
        type: 'community_spotlight',
      };

      await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .doc('community_spotlight')
        .set(spotlightData);

      console.log('Updated community spotlight cache');

    } catch (error) {
      console.error('Error updating community spotlight cache:', error);
    }
  }

  // Manual trigger for testing
  async manualPoll(serverId: string): Promise<void> {
    console.log('Manual poll triggered');
    await this.pollTwitchData(serverId);
    try {
      console.log('Manual poll completed, running automated shoutout cycle...');
      await runAutomatedShoutoutCycle(serverId, { force: true });
      console.log('Automated shoutout cycle finished');
    } catch (error) {
      console.error('Automated shoutout cycle failed:', error);
    }
  }

  // Get cached GIF for a user
  async getCachedGif(serverId: string, username: string): Promise<CachedClip | null> {
    try {
      const doc = await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .doc(username.toLowerCase())
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as CachedClip;
    } catch (error) {
      console.error(`Error getting cached GIF for ${username}:`, error);
      return null;
    }
  }

  // Get community spotlight cache
  async getCommunitySpotlight(serverId: string): Promise<CachedClip | null> {
    try {
      const doc = await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .doc('community_spotlight')
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as CachedClip;
    } catch (error) {
      console.error('Error getting community spotlight cache:', error);
      return null;
    }
  }

  private async getLastCleanupTime(serverId: string): Promise<number | null> {
    try {
      const doc = await db.collection('servers').doc(serverId).get();
      return doc.data()?.lastCleanup?.toMillis() || null;
    } catch (error) {
      return null;
    }
  }

  private async setLastCleanupTime(serverId: string): Promise<void> {
    try {
      await db.collection('servers').doc(serverId).update({
        lastCleanup: new Date()
      });
    } catch (error) {
      console.error('Error setting cleanup time:', error);
    }
  }
}

const pollingService = new PollingService();

export async function startPolling(serverId: string): Promise<void> {
  return pollingService.startPolling(serverId);
}

export async function stopPolling(): Promise<void> {
  return pollingService.stopPolling();
}

export async function manualPoll(serverId: string): Promise<void> {
  return pollingService.manualPoll(serverId);
}

export async function getCachedGif(serverId: string, username: string) {
  return pollingService.getCachedGif(serverId, username);
}

export async function getCommunitySpotlight(serverId: string) {
  return pollingService.getCommunitySpotlight(serverId);
}
