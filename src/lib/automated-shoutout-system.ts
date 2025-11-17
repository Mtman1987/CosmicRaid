'use server';

import { db } from "@/firebase/server-init";
import { FieldValue } from 'firebase-admin/firestore';
import { generateAllShoutouts } from "./community-shoutout-service";
import { updateCommunitySpotlight } from "./community-spotlight-service";
import { cleanupAllOldClips } from "./clip-management-service";
import { sendDiscordMessage, updateDiscordMessage, deleteDiscordMessage, cleanupDuplicateBotMessages } from "./discord-bot-service";
import { updateVipSpotlights } from "./vip-spotlight-service";
import { getSecret } from './firestore-secrets';

type PostOptions = {
  includeCommunity?: boolean;
  includeVip?: boolean;
  includeSpotlight?: boolean;
};
import { isCommunityGroup, isVipGroup } from "./group-utils";

async function getDiscordInvite(): Promise<string | null> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/discord/create-invite`, {
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


interface CycleOptions {
  force?: boolean;
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
    console.log(`[AutoShoutout] [${cycleId}] Starting automated cycle for server ${serverId}`);
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
    console.log(`[AutoShoutout] Cleaned up ${cleanedCount} old clips`);
    
    // 2. Generate/refresh VIP spotlight clips
    await updateVipSpotlights(serverId);
    console.log(`[AutoShoutout] Updated VIP spotlights`);
    
    // 3. Generate all shoutouts (Community + VIP)
    const shoutoutResults = await generateAllShoutouts(serverId);
    console.log(`[AutoShoutout] Generated ${shoutoutResults.length} shoutouts`);
    
    // 4. Update community spotlight (rotates to next user)
    await updateCommunitySpotlight(serverId);
    console.log(`[AutoShoutout] Updated community spotlight`);
    
    // 5. Post all shoutouts to Discord
    await postAllShoutoutsToDiscord(serverId);
    console.log(`[AutoShoutout] Posted all shoutouts to Discord`);
    
    // 6. Increment daily shoutout counter once per cycle
    const { incrementDailyShoutoutCount } = await import('./community-spotlight-enhanced-service');
    await incrementDailyShoutoutCount(serverId);
    
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

    // Get server config for channel IDs
    const serverDoc = await db.collection('servers').doc(serverId).get();
    const serverData = serverDoc.data();
    
    if (!serverData) {
      console.log('[AutoShoutout] No server config found');
      return;
    }
    
    const customChannels = serverData.shoutoutChannels || {};
    const communityChannelId =
      customChannels.community ||
      serverData.config?.channels?.community ||
      await getSecret('DISCORD_SHOUTOUT_CHANNEL_ID');
    const vipChannelId =
      customChannels.vip ||
      serverData.config?.channels?.vip ||
      await getSecret('DISCORD_VIP_CHANNEL_ID');
    
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
          if (isCommunityGroup(userData.group)) {
            communityUsers.push(userData);
          } else if (isVipGroup(userData.group)) {
            vipUsers.push(userData);
          }
        }
      }
    }
    
    // Collect current message IDs for cleanup
    const communityKeepIds: string[] = [];
    const vipKeepIds: string[] = [];
    
    if (includeCommunity) {
      console.log(`[AutoShoutout] Community Channel ID: ${communityChannelId}`);
      console.log(`[AutoShoutout] Found ${communityUsers.length} community users`);
      
      if (communityUsers.length > 0 && communityChannelId) {
        console.log(`[AutoShoutout] Processing ${communityUsers.length} community shoutouts to channel ${communityChannelId}`);
        
        for (const user of communityUsers) {
          if (user.dailyShoutout) {
            console.log(`[AutoShoutout] Posting community shoutout for ${user.username}`);
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
      console.log(`[AutoShoutout] VIP Channel ID: ${vipChannelId}`);
      console.log(`[AutoShoutout] Found ${vipUsers.length} VIP users`);
      if (vipUsers.length > 0) {
        console.log(`[AutoShoutout] VIP users:`, vipUsers.map(u => `${u.username} (${u.group})`));
      }
      
      if (vipUsers.length > 0 && vipChannelId) {
        console.log(`[AutoShoutout] Processing ${vipUsers.length} VIP shoutouts to channel ${vipChannelId}`);
        
        for (const user of vipUsers) {
          if (user.dailyShoutout) {
            console.log(`[AutoShoutout] Posting VIP shoutout for ${user.username}`);
            const messageId = await postOrUpdateShoutout(vipChannelId, user, serverId);
            if (messageId) vipKeepIds.push(messageId);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else if (vipUsers.length > 0 && !vipChannelId) {
        console.log(`[AutoShoutout] WARNING: ${vipUsers.length} VIP users found but no VIP channel configured`);
      } else if (vipUsers.length === 0 && vipChannelId) {
        // No VIPs live, post community spotlight to VIP channel as fallback
        console.log(`[AutoShoutout] No VIPs live, posting community spotlight to VIP channel`);
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
  setInterval(async () => {
    await runAutomatedShoutoutCycle(serverId);
  }, getShoutoutIntervalMs());
  
  console.log(`[AutoShoutout] Started automated shoutout system for server ${serverId}`);
}

export async function postVipShoutouts(serverId: string): Promise<void> {
  return postAllShoutoutsToDiscord(serverId, {
    includeCommunity: false,
    includeVip: true,
    includeSpotlight: false,
  });
}

export async function postCommunityShoutouts(serverId: string): Promise<void> {
  return postAllShoutoutsToDiscord(serverId, {
    includeCommunity: true,
    includeVip: false,
    includeSpotlight: true,
  });
}

async function postOrUpdateShoutout(channelId: string, user: any, serverId: string): Promise<string | null> {
  const messageId = user.discordMessageId;
  try {
    if (messageId) {
      const updated = await updateDiscordMessage(channelId, messageId, user.dailyShoutout);
      if (updated) {
        await recordUserDiscordPost(serverId, user.username, messageId);
        console.log(`[AutoShoutout] Updated Discord post for ${user.username} at ${new Date().toISOString()}`);
        await logDiscordDelivery(serverId, {
          username: user.username,
          channelId,
          status: 'updated',
          messageId
        });
        // Increment daily shoutout counter for tracking
        const { incrementDailyShoutoutCount } = await import('./community-spotlight-enhanced-service');
        await incrementDailyShoutoutCount(serverId, user.username);
        return messageId;
      } else {
        await deleteDiscordMessage(channelId, messageId);
        const newMessageId = await sendDiscordMessage(channelId, user.dailyShoutout);
        if (newMessageId) {
          await recordUserDiscordPost(serverId, user.username, newMessageId);
          console.log(`[AutoShoutout] Reposted Discord message for ${user.username} at ${new Date().toISOString()}`);
          await logDiscordDelivery(serverId, {
            username: user.username,
            channelId,
            status: 'reposted',
            messageId: newMessageId
          });
          // Increment daily shoutout counter for tracking
          const { incrementDailyShoutoutCount } = await import('./community-spotlight-enhanced-service');
          await incrementDailyShoutoutCount(serverId, user.username);
        }
        return newMessageId;
      }
    } else {
      const newMessageId = await sendDiscordMessage(channelId, user.dailyShoutout);
      if (newMessageId) {
        await recordUserDiscordPost(serverId, user.username, newMessageId);
        console.log(`[AutoShoutout] Posted new Discord message for ${user.username} at ${new Date().toISOString()}`);
        await logDiscordDelivery(serverId, {
          username: user.username,
          channelId,
          status: 'posted',
          messageId: newMessageId
        });
        // Increment daily shoutout counter for tracking
        const { incrementDailyShoutoutCount } = await import('./community-spotlight-enhanced-service');
        await incrementDailyShoutoutCount(serverId, user.username);
      }
      return newMessageId;
    }
  } catch (error) {
    await logDiscordDelivery(serverId, {
      username: user.username,
      channelId,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function postOrUpdateSpotlightWithButton(channelId: string, messageData: any, serverId: string): Promise<string | null> {
  // Get spotlight data to find existing message ID
  const spotlightRef = db.collection('servers').doc(serverId).collection('spotlight').doc('current');
  const spotlightDoc = await spotlightRef.get();
  const spotlightData = spotlightDoc.data();
  const messageId = spotlightData?.discordMessageId;
  
  if (messageId) {
    try {
      const updated = await updateDiscordMessage(channelId, messageId, messageData);
      if (updated) {
        await updateSpotlightMessageMetadata(serverId, messageId, { keepId: true });
        await logDiscordDelivery(serverId, {
          username: messageData?.content ?? 'spotlight',
          channelId,
          status: 'spotlight-updated',
          messageId
        });
        console.log(`[SpotlightPost] Updated spotlight message ${messageId} at ${new Date().toISOString()}`);
        return messageId;
      } else {
        await deleteDiscordMessage(channelId, messageId);
      }
    } catch (error) {
      await logDiscordDelivery(serverId, {
        username: messageData?.content ?? 'spotlight',
        channelId,
        status: 'spotlight-error',
        messageId,
        error: error instanceof Error ? error.message : String(error)
      });
      await deleteDiscordMessage(channelId, messageId);
    }
  } else {
    // fallthrough to posting new
  }

  const newMessageId = await sendDiscordMessage(channelId, messageData);
  if (newMessageId) {
    await updateSpotlightMessageMetadata(serverId, newMessageId);
    await logDiscordDelivery(serverId, {
      username: messageData?.content ?? 'spotlight',
      channelId,
      status: 'spotlight-posted',
      messageId: newMessageId
    });
    console.log(`[SpotlightPost] Posted new spotlight message ${newMessageId} at ${new Date().toISOString()}`);
  }
  return newMessageId;
}

async function recordUserDiscordPost(serverId: string, username: string, messageId?: string | null): Promise<void> {
  try {
    const userRef = db
      .collection('servers')
      .doc(serverId)
      .collection('users')
      .where('username', '==', username)
      .limit(1);
    const snapshot = await userRef.get();
    
    if (!snapshot.empty) {
      const updatePayload: Record<string, any> = {
        lastDiscordPostAt: new Date()
      };
      if (messageId) {
        updatePayload.discordMessageId = messageId;
      }
      await snapshot.docs[0].ref.update(updatePayload);
    }
  } catch (error) {
    console.error(`Error updating Discord metadata for ${username}:`, error);
  }
}

async function updateSpotlightMessageMetadata(serverId: string, messageId: string, options: { keepId?: boolean } = {}): Promise<void> {
  try {
    const updates: Record<string, any> = {
      lastDiscordPostAt: new Date()
    };
    if (!options.keepId) {
      updates.discordMessageId = messageId;
    }
    await db
      .collection('servers')
      .doc(serverId)
      .collection('spotlight')
      .doc('current')
      .update(updates);
  } catch (error) {
    console.error('Error updating spotlight message metadata:', error);
  }
}

export async function postCommunitySpotlightMessage(serverId: string, explicitChannelId?: string, keepIds?: string[]): Promise<void> {
  try {
    // Check cooldown - don't post spotlight more than once every 9 minutes
    const cooldownRef = db.collection('servers').doc(serverId).collection('spotlightCooldowns').doc('discord');
    const cooldownDoc = await cooldownRef.get();
    const cooldownMs = 9 * 60 * 1000; // 9 minutes
    
    if (cooldownDoc.exists) {
      const lastPosted = cooldownDoc.data()?.lastPosted?.toMillis();
      if (lastPosted && (Date.now() - lastPosted) < cooldownMs) {
        console.log('[SpotlightPost] Skipping - cooldown active');
        return;
      }
    }

    let channelId = explicitChannelId;
    if (!channelId) {
      const serverDoc = await db.collection('servers').doc(serverId).get();
      const serverData = serverDoc.data();
      if (!serverData) {
        console.log('[SpotlightPost] No server config found');
        return;
      }
      const customChannels = serverData.shoutoutChannels || {};
      channelId =
        customChannels.community ||
        serverData.config?.channels?.community ||
        await getSecret('DISCORD_SHOUTOUT_CHANNEL_ID');
    }

    if (!channelId) {
      console.log('[SpotlightPost] No community channel configured');
      return;
    }

    const spotlightRef = db.collection('servers').doc(serverId).collection('spotlight').doc('current');
    const spotlightDoc = await spotlightRef.get();
    const spotlightData = spotlightDoc.exists ? spotlightDoc.data() : null;
    
    // If no spotlight data, try to generate one
    if (!spotlightData?.cardGifUrl) {
      console.log('[SpotlightPost] No active spotlight, generating new one');
      const { updateCommunitySpotlight } = await import('./community-spotlight-service');
      await updateCommunitySpotlight(serverId);
      
      // Try to get spotlight again after generation
      const newSpotlightDoc = await spotlightRef.get();
      const newSpotlightData = newSpotlightDoc.exists ? newSpotlightDoc.data() : null;
      
      if (!newSpotlightData?.cardGifUrl) {
        console.log('[SpotlightPost] Still no spotlight after generation, trying server-side fallback');
        
        // Try server-side fallback (uses FreeConvert API instead of local puppeteer/ffmpeg)
        const { updateSpotlightWithServerSideFallback } = await import('./community-spotlight-serverside-fallback');
        const fallbackSuccess = await updateSpotlightWithServerSideFallback(serverId);
        
        if (fallbackSuccess) {
          // Get the fallback-generated spotlight
          const fallbackSpotlightDoc = await spotlightRef.get();
          const fallbackSpotlightData = fallbackSpotlightDoc.exists ? fallbackSpotlightDoc.data() : null;
          
          if (fallbackSpotlightData?.cardGifUrl) {
            console.log('[SpotlightPost] Server-side fallback succeeded');
            spotlightData = fallbackSpotlightData;
          } else {
            console.log('[SpotlightPost] Server-side fallback did not generate GIF, using basic fallback');
            // Use the basic fallback (no one live message)
            const { postCommunitySpotlightFallback } = await import('./community-spotlight-fallback-service');
            await postCommunitySpotlightFallback(serverId, channelId, keepIds);
            return;
          }
        } else {
          console.log('[SpotlightPost] Server-side fallback failed, using basic fallback');
          // Use the basic fallback (no one live message)
          const { postCommunitySpotlightFallback } = await import('./community-spotlight-fallback-service');
          await postCommunitySpotlightFallback(serverId, channelId, keepIds);
          return;
        }
      } else {
        // Use the newly generated spotlight
        spotlightData = newSpotlightData;
      }
    }

    // Generate enhanced spotlight with header and footer
    const { getCommunityStats, generateSpotlightHeaderImage, generateSpotlightFooterImage } = await import('./community-spotlight-enhanced-service');
    const stats = await getCommunityStats(serverId);
    console.log('[SpotlightPost] Community stats:', stats);
    
    console.log('[SpotlightPost] Generating header and footer images...');
    const headerImageUrl = await generateSpotlightHeaderImage(serverId, stats);
    console.log('[SpotlightPost] Header generation completed:', headerImageUrl ? 'success' : 'failed');
    
    const footerImageUrl = await generateSpotlightFooterImage(serverId, stats);
    console.log('[SpotlightPost] Footer generation completed:', footerImageUrl ? 'success' : 'failed');

    // Post header image (no embed, just image)
    if (headerImageUrl) {
      const headerMessage = { content: headerImageUrl };
      const headerMessageId = await sendDiscordMessage(channelId, headerMessage);
      if (headerMessageId && keepIds) keepIds.push(headerMessageId);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Post main spotlight GIF (no embed, just GIF)
    const spotlightMessage = { content: spotlightData.cardGifUrl };
    const spotlightMessageId = await sendDiscordMessage(channelId, spotlightMessage);
    if (spotlightMessageId && keepIds) keepIds.push(spotlightMessageId);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Post footer image (no embed, just image)
    if (footerImageUrl) {
      const footerMessage = { content: footerImageUrl };
      const footerMessageId = await sendDiscordMessage(channelId, footerMessage);
      if (footerMessageId && keepIds) keepIds.push(footerMessageId);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Get Discord invite URL
    const inviteUrl = await getDiscordInvite();
    
    // Post button message (text with buttons, no image)
    const buttonMessage = {
      content: `🚀 **Community Spotlight:** ${spotlightData.streamerName} - ${spotlightData.streamData?.game || 'Just Chatting'}`,
      components: [{
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "🚀 LAUNCH MISSION",
            url: `https://twitch.tv/${spotlightData.streamerName}`
          },
          ...(inviteUrl ? [{
            type: 2,
            style: 5,
            label: "JOIN SPACE MOUNTAIN",
            url: inviteUrl
          }] : [])
        ]
      }]
    };
    const buttonMessageId = await sendDiscordMessage(channelId, buttonMessage);
    if (buttonMessageId && keepIds) keepIds.push(buttonMessageId);

    // Update cooldown
    await cooldownRef.set({
      lastPosted: new Date(),
      channelId,
      streamerName: spotlightData?.streamerName
    });

    console.log(`[SpotlightPost] Posted enhanced community spotlight for ${spotlightData?.streamerName}`);
  } catch (error) {
    console.error('[SpotlightPost] Failed to post spotlight:', error);
  }
}

async function logDiscordDelivery(serverId: string, log: { username?: string; channelId: string; status: string; messageId?: string | null; error?: string }) {
  try {
    await db.collection('servers').doc(serverId).collection('shoutoutLogs').add({
      username: log.username || null,
      channelId: log.channelId,
      status: log.status,
      messageId: log.messageId || null,
      error: log.error || null,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Failed to log Discord delivery', err);
  }
}