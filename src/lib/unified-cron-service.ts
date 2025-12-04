'use server';

import { db } from '@/firebase/server-init';
import { checkMultipleStreamsStatus } from './twitch-api-service';
import { generateAllShoutouts } from './community-shoutout-service';
import { postAllShoutoutsToDiscord } from './automated-shoutout-system';
import { updateCommunitySpotlight } from './community-spotlight-service';
import { cleanupOldClips } from './twitch-clip-service';

/**
 * Unified cron service that combines Twitch polling and shoutout generation
 * Optimized to batch Twitch API calls across all servers
 */
export async function runUnifiedCronCycle(): Promise<{
  success: boolean;
  serversProcessed: number;
  totalUsers: number;
  apiCalls: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let serversProcessed = 0;
  let totalUsers = 0;
  let apiCalls = 0;

  try {
    console.log('[UnifiedCron] Starting optimized unified cron cycle...');

    // Get all active sessions
    const sessionsSnapshot = await db.collection('userSessions').get();
    const serverIds = new Set<string>();
    
    sessionsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data?.serverId) {
        serverIds.add(data.serverId);
      }
    });

    console.log('[UnifiedCron] Processing active servers:', serverIds.size);

    // 1. Collect ALL users from ALL servers first
    const allServerUsers: Map<string, {
      serverId: string;
      users: Array<{ id: string; username: string; data: any }>;
    }> = new Map();

    for (const serverId of serverIds) {
      try {
        const usersSnapshot = await db.collection('servers').doc(serverId).collection('users').get();
        const validUsers: Array<{ id: string; username: string; data: any }> = [];
        
        usersSnapshot.docs.forEach(doc => {
          const userData = doc.data();
          if (userData.username && typeof userData.username === 'string') {
            const cleanUsername = userData.username.toLowerCase().trim();
            const reservedNames = ['cosmo', 'dyno', 'translator', 'patchbot', 'xenon'];
            
            if (/^[a-zA-Z0-9_]{4,25}$/.test(cleanUsername) && 
                !cleanUsername.includes('__') && 
                !reservedNames.includes(cleanUsername) &&
                !cleanUsername.startsWith('_') &&
                !cleanUsername.endsWith('_')) {
              validUsers.push({ id: doc.id, username: cleanUsername, data: userData });
            }
          }
        });
        
        if (validUsers.length > 0) {
          allServerUsers.set(serverId, { serverId, users: validUsers });
          totalUsers += validUsers.length;
        }
      } catch (error) {
        errors.push(`Failed to fetch users for server ${serverId?.replace(/[\r\n]/g, '')}: ${error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error'}`);
      }
    }

    // 2. Batch ALL usernames across ALL servers for optimal API usage
    const allUsernames: string[] = [];
    const usernameToServers: Map<string, string[]> = new Map();
    
    for (const [serverId, serverData] of allServerUsers) {
      for (const user of serverData.users) {
        if (!allUsernames.includes(user.username)) {
          allUsernames.push(user.username);
        }
        
        const servers = usernameToServers.get(user.username) || [];
        servers.push(serverId);
        usernameToServers.set(user.username, servers);
      }
    }

    console.log('[UnifiedCron] Checking unique users:', allUsernames.length, 'across servers:', serverIds.size);
    apiCalls = Math.ceil(allUsernames.length / 100);
    console.log('[UnifiedCron] Will use Twitch API calls:', apiCalls, '(limit: 100 per call)');

    // 3. Single batched Twitch API call for ALL users
    // Use the first serverId for authentication (all servers should have same Twitch credentials)
    const firstServerId = Array.from(serverIds)[0];
    const streamStatusMap = await checkMultipleStreamsStatus(allUsernames, firstServerId);

    // 4. Update each server with their users' status
    for (const [serverId, serverData] of allServerUsers) {
      try {
        await updateServerWithStatus(serverId, serverData.users, streamStatusMap);
        serversProcessed++;
      } catch (error) {
        errors.push(`Failed to update server ${serverId?.replace(/[\r\n]/g, '')}: ${error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error'}`);
      }
    }

    console.log('[UnifiedCron] Optimized cycle complete. Servers:', serversProcessed + '/' + serverIds.size, 'Users:', totalUsers, 'API calls:', apiCalls);

    return {
      success: errors.length === 0,
      serversProcessed,
      totalUsers,
      apiCalls,
      errors
    };

  } catch (error) {
    const errorMsg = `Global error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.error('[UnifiedCron] Global error:', error);
    
    return {
      success: false,
      serversProcessed,
      totalUsers,
      apiCalls,
      errors
    };
  }
}

/**
 * Update a single server with Twitch status results
 */
async function updateServerWithStatus(
  serverId: string, 
  users: Array<{ id: string; username: string; data: any }>,
  streamStatusMap: Map<string, boolean>
): Promise<void> {
  console.log('[UnifiedCron] Updating server:', serverId?.replace(/[\r\n]/g, ''), 'with users:', users.length);

  // Update online status in Firestore
  const batch = db.batch();
  let updatedCount = 0;
  const onlineUsers: string[] = [];

  for (const user of users) {
    const isOnline = streamStatusMap.get(user.username) || false;
    
    if (isOnline) {
      onlineUsers.push(user.username);
    }
    
    // Force update all users to ensure status is current
    const userRef = db.collection('servers').doc(serverId).collection('users').doc(user.id);
    batch.update(userRef, {
      isOnline,
      lastStatusUpdate: new Date(),
      lastTwitchData: {
        isLive: isOnline,
        updatedAt: new Date()
      }
    });
    updatedCount++;
    
    if (user.data.isOnline !== isOnline) {
      console.log(`[UnifiedCron] Status changed for ${user.username}: ${user.data.isOnline} -> ${isOnline}`);
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
    console.log('[UnifiedCron] Updated user statuses:', updatedCount, 'for server:', serverId?.replace(/[\r\n]/g, ''));
  }

  console.log('[UnifiedCron] Found online users:', onlineUsers.length, 'for server:', serverId?.replace(/[\r\n]/g, ''));

  // Update community spotlight
  try {
    await updateCommunitySpotlight(serverId);
  } catch (error) {
    console.error('[UnifiedCron] Error updating community spotlight for server:', serverId?.replace(/[\r\n]/g, ''), error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error');
  }

  // Generate shoutouts
  try {
    await generateAllShoutouts(serverId);
  } catch (error) {
    console.error('[UnifiedCron] Error generating shoutouts for server:', serverId?.replace(/[\r\n]/g, ''), error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error');
  }

  // Post to Discord
  try {
    await postAllShoutoutsToDiscord(serverId);
  } catch (error) {
    console.error('[UnifiedCron] Error posting shoutouts for server:', serverId?.replace(/[\r\n]/g, ''), error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error');
  }

  // Post community spotlight as separate message
  try {
    const { postCommunitySpotlight } = await import('./community-spotlight-poster');
    await postCommunitySpotlight(serverId);
  } catch (error) {
    console.error('[UnifiedCron] Error posting community spotlight for server:', serverId?.replace(/[\r\n]/g, ''), error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error');
  }

  // Cleanup (10% chance)
  if (Math.random() < 0.1) {
    try {
      await cleanupOldClips(serverId);
    } catch (error) {
      console.error('[UnifiedCron] Error cleaning up clips for server:', serverId?.replace(/[\r\n]/g, ''), error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error');
    }
  }
}