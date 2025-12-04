'use server';

import { db } from "@/firebase/server-init";
import { FieldValue } from 'firebase-admin/firestore';
import { generateAllShoutouts } from "./community-shoutout-service";
import { updateCommunitySpotlight } from "./community-spotlight-service";
import { cleanupAllOldClips } from "./clip-management-service";
import { sendDiscordMessage, updateDiscordMessage, deleteDiscordMessage, cleanupDuplicateBotMessages } from "./discord-bot-service";
import { updateVipAnimatedCards } from "./vip-animated-card-service";
import { getSecret } from './firestore-secrets';
import { getDiscordBotToken } from './discord-bot-token';
import { isCommunityGroup, isVipGroup } from './group-utils-server';

// Internal types - not exported
type PostOptions = {
  includeCommunity?: boolean;
  includeVip?: boolean;
  includeSpotlight?: boolean;
};

// Internal interface - not exported
interface CycleOptions {
  force?: boolean;
}

// Internal helper function - not exported
async function getDiscordInvite(): Promise<string | null> {
  try {
    const appUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';

    const response = await fetch(`${appUrl}/api/discord/create-invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (response.ok) {
      const data = await response.json();
      return data.inviteUrl;
    }
  } catch (error) {
    console.error('Failed to create Discord invite:', error);
  }
  const discordInvite = await getSecret('DISCORD_INVITE_URL');
  return process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || discordInvite || null;
}

function getShoutoutIntervalMs() {
  const minutes = Number(process.env.SHOUTOUT_INTERVAL_MINUTES || process.env.NEXT_PUBLIC_SHOUTOUT_INTERVAL_MINUTES || 10);
  return Math.max(1, minutes) * 60 * 1000;
}

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function runAutomatedShoutoutCycle(serverId: string, options: CycleOptions = {}): Promise<void> {
  try {
    const cycleId = Date.now();
    console.log(`[AutoShoutout] [${cycleId}] Starting automated cycle for server`, serverId?.replace(/[\r\n]/g, ''));
    if (!options.force) {
      const serverDoc = await db.collection('servers').doc(serverId).get();
      const lastRun = toDate(serverDoc.data()?.lastShoutoutCycle);
      const intervalMs = getShoutoutIntervalMs();
      if (lastRun) {
        const elapsed = Date.now() - lastRun.getTime();
        if (elapsed < intervalMs) {
          const wait = Math.ceil((intervalMs - elapsed) / 1000);
          console.log(`[AutoShoutout] [${cycleId}] Skipping cycle; next eligible run in ${wait}s`);
          return;
        }
      }
    }
    
    // 1. Clean up old clips first
    const cleanedCount = await cleanupAllOldClips(serverId);
    console.log('[AutoShoutout] Cleaned up old clips:', cleanedCount);
    
    // 2. Generate/refresh VIP animated cards
    await updateVipAnimatedCards(serverId);
    console.log('[AutoShoutout] Updated VIP animated cards');
    
    // 3. Generate all shoutouts (Community + VIP)
    const shoutoutResults = await generateAllShoutouts(serverId);
    console.log('[AutoShoutout] Generated shoutouts:', shoutoutResults.length);
    
    // 4. Update community spotlight (rotates to next user)
    await updateCommunitySpotlight(serverId);
    console.log('[AutoShoutout] Updated community spotlight');
    
    // 5. Post all shoutouts to Discord
    await postAllShoutoutsToDiscord(serverId);
    console.log('[AutoShoutout] Posted all shoutouts to Discord');
    
    // 6. Daily shoutout counter (handled elsewhere)
    
    // 7. Update last run timestamp
    await db.collection('servers').doc(serverId).update({
      lastShoutoutCycle: new Date(),
      shoutoutCycleCount: FieldValue.increment(1)
    });
    
    console.log(`[AutoShoutout] [${cycleId}] Cycle completed successfully`);
    
  } catch (error) {
    console.error(`[AutoShoutout] Error in automated cycle:`, error);
  }
}

export async function postAllShoutoutsToDiscord(serverId: string, options: PostOptions = {}): Promise<void> {
  try {
    const {
      includeCommunity = true,
      includeVip = true,
      includeSpotlight = includeCommunity,
    } = options;

    // Get channel config from where the UI saves it
    const channelsDoc = await db.collection('servers').doc(serverId).collection('config').doc('channels').get();
    const channelsData = channelsDoc.exists ? channelsDoc.data() : {};
    
    const communityChannelId = channelsData?.community || await getSecret('DISCORD_SHOUTOUT_CHANNEL_ID');
    const vipChannelId = channelsData?.vip || await getSecret('DISCORD_VIP_CHANNEL_ID');
    
    // Get all users with generated shoutouts (split query to avoid composite index)
    const usersRef = db.collection('servers').doc(serverId).collection('users');
    const snapshot = await usersRef
      .where('isOnline', '==', true)
      .get();
    
    // Separate Community and VIP users (filter for dailyShoutout in memory)
    const communityUsers: any[] = [];
    const vipUsers: any[] = [];
    
    if (!snapshot.empty) {
      for (const doc of snapshot.docs) {
        const userData = doc.data();
        // Only include users with dailyShoutout
        if (userData.dailyShoutout) {
          if (await isCommunityGroup(userData.group, serverId)) {
            communityUsers.push(userData);
          } else if (await isVipGroup(userData.group, serverId)) {
            vipUsers.push(userData);
          }
        }
      }
    }
    
    // Collect current message IDs for cleanup
    const communityKeepIds: string[] = [];
    const vipKeepIds: string[] = [];
    
    if (includeCommunity) {
      console.log('[AutoShoutout] Community Channel ID:', communityChannelId?.replace(/[\r\n]/g, ''));
      console.log('[AutoShoutout] Found community users:', communityUsers.length);
      
      if (communityUsers.length > 0 && communityChannelId) {
        console.log('[AutoShoutout] Processing community shoutouts:', communityUsers.length, 'to channel', communityChannelId?.replace(/[\r\n]/g, ''));
        
        for (const user of communityUsers) {
          if (user.dailyShoutout) {
            console.log('[AutoShoutout] Posting community shoutout for:', user.username?.replace(/[\r\n]/g, ''));
            const messageId = await postOrUpdateShoutout(communityChannelId, user, serverId);
            if (messageId) communityKeepIds.push(messageId);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
      
    }
    
    // Always post community spotlight (even if no community users online)
    if (includeCommunity && includeSpotlight && communityChannelId) {
      await postCommunitySpotlightMessage(serverId, communityChannelId, communityKeepIds);
    }
    
    if (includeVip) {
      console.log('[AutoShoutout] VIP Channel ID:', vipChannelId?.replace(/[\r\n]/g, ''));
      console.log('[AutoShoutout] Found VIP users:', vipUsers.length);
      if (vipUsers.length > 0) {
        console.log('[AutoShoutout] VIP users:', vipUsers.map(u => `${u.username?.replace(/[\r\n]/g, '')} (${u.group?.replace(/[\r\n]/g, '')})`));
      }
      
      if (vipUsers.length > 0 && vipChannelId) {
        console.log('[AutoShoutout] Processing VIP shoutouts:', vipUsers.length, 'to channel', vipChannelId?.replace(/[\r\n]/g, ''));
        
        for (const user of vipUsers) {
          if (user.dailyShoutout) {
            console.log('[AutoShoutout] Posting VIP shoutout for:', user.username?.replace(/[\r\n]/g, ''));
            const messageId = await postOrUpdateShoutout(vipChannelId, user, serverId);
            if (messageId) vipKeepIds.push(messageId);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else if (vipUsers.length > 0 && !vipChannelId) {
        console.log('[AutoShoutout] WARNING: VIP users found but no VIP channel configured:', vipUsers.length);
      } else if (vipUsers.length === 0 && vipChannelId) {
        // No VIPs live, post community spotlight to VIP channel as fallback
        console.log('[AutoShoutout] No VIPs live, posting community spotlight to VIP channel');
        await postCommunitySpotlightMessage(serverId, vipChannelId, vipKeepIds);
      }
    }
    
    // Clean up old messages in both channels
    if (communityChannelId) {
      await cleanupDuplicateBotMessages(communityChannelId, communityKeepIds);
    }
    if (vipChannelId) {
      await cleanupDuplicateBotMessages(vipChannelId, vipKeepIds);
    }
    
  } catch (error) {
    console.error('[AutoShoutout] Error posting to Discord:', error);
  }
}

export async function startAutomatedShoutouts(serverId: string): Promise<void> {
  // Run initial cycle
  await runAutomatedShoutoutCycle(serverId);
  
  // Set up 10-minute interval
  setInterval(() => {
    runAutomatedShoutoutCycle(serverId);
  }, getShoutoutIntervalMs());
}

async function postOrUpdateShoutout(channelId: string, user: any, serverId: string): Promise<string | null> {
  try {
    const description = typeof user.dailyShoutout === 'string' 
      ? user.dailyShoutout 
      : user.dailyShoutout?.description || 'Come check out the stream!';
    
    const isVip = await isVipGroup(user.group, serverId);
    const mediaUrl = isVip ? user.dailyShoutout?.gifUrl : user.dailyShoutout?.imageUrl;
    
    // Send image/gif first if available
    if (mediaUrl) {
      await sendDiscordMessage(channelId, {
        content: mediaUrl
      });
    }
    
    // Send embed with join stream button
    const messageId = await sendDiscordMessage(channelId, {
      embeds: [{
        title: `🎮 ${user.username} is live!`,
        description,
        color: 0x9146FF,
        thumbnail: { url: user.avatarUrl || '' },
        timestamp: new Date().toISOString()
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5, // Link button
          label: 'Join Stream',
          url: `https://twitch.tv/${user.username}`
        }]
      }]
    });
    return messageId;
  } catch (error) {
    console.error('Failed to post shoutout:', error);
    return null;
  }
}

async function postCommunitySpotlightMessage(serverId: string, channelId: string, keepIds: string[]): Promise<void> {
  try {
    const { postCommunitySpotlight } = await import('./community-spotlight-poster');
    await postCommunitySpotlight(serverId);
  } catch (error) {
    console.error('Failed to post community spotlight:', error);
  }
}

/**
 * Post a single shoutout to Discord
 */
export async function postShoutoutToDiscord(serverId: string, channelId: string, streamerName: string, shoutoutData: any): Promise<void> {
  try {
    const description = typeof shoutoutData === 'string' 
      ? shoutoutData 
      : shoutoutData?.description || `Come check out ${streamerName}'s stream!`;
    
    // Send image/gif first if available
    const mediaUrl = shoutoutData?.gifUrl || shoutoutData?.imageUrl;
    if (mediaUrl) {
      await sendDiscordMessage(channelId, {
        content: mediaUrl
      });
    }
    
    // Send embed with join stream button
    const messageId = await sendDiscordMessage(channelId, {
      embeds: [{
        title: `🎮 ${streamerName} is live!`,
        description,
        color: 0x9146FF,
        thumbnail: { url: shoutoutData?.avatarUrl || '' },
        timestamp: new Date().toISOString()
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5, // Link button
          label: 'Join Stream',
          url: `https://twitch.tv/${streamerName}`
        }]
      }]
    });
    
    console.log(`[PostShoutout] Posted shoutout for ${streamerName} to channel ${channelId}, message ID: ${messageId}`);
  } catch (error) {
    console.error(`[PostShoutout] Failed to post shoutout for ${streamerName}:`, error);
    throw error;
  }
}
