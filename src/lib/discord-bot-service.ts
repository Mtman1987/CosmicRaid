
'use server';

import { db } from '@/firebase/server-init';
import { isVipGroup } from './group-utils';
import type { DocumentData } from 'firebase-admin/firestore';

let botUserIdCache: string | null = null;

async function getBotUserId(botToken: string): Promise<string> {
  if (botUserIdCache) return botUserIdCache;
  const response = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${botToken}` },
  });
  const data = await response.json();
  botUserIdCache = data.id;
  return data.id;
}

export async function postAllShoutoutsToDiscord(serverId: string, usersToPost?: DocumentData[]): Promise<void> {
  let usersSnapshot: DocumentData[] = [];

  if (usersToPost) {
    console.log('[DiscordBot] Using provided mock data for posting.');
    usersSnapshot = usersToPost;
  } else {
    console.log('[DiscordBot] Fetching online users from Firestore for posting.');
    const snapshot = await db
      .collection('servers')
      .doc(serverId)
      .collection('users')
      .where('isOnline', '==', true)
      .get();
    usersSnapshot = snapshot.docs.map(doc => doc.data());
  }

  if (usersSnapshot.length === 0) {
    console.log('[DiscordBot] No users found to post shoutouts for.');
    return;
  }

  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error('[DiscordBot] DISCORD_BOT_TOKEN is not configured.');
    return;
  }

  const serverConfig = (await db.collection('servers').doc(serverId).get()).data() || {};
  const channelConfig = serverConfig.shoutoutChannels || {};

  const vipChannelId = channelConfig.vip || process.env.DISCORD_VIP_CHANNEL_ID;
  const communityChannelId = channelConfig.community || process.env.DISCORD_SHOUTOUT_CHANNEL_ID;

  for (const user of usersSnapshot) {
    if (!user.dailyShoutout) continue;

    const targetChannelId = isVipGroup(user.group) ? vipChannelId : communityChannelId;

    if (!targetChannelId) {
      console.warn(`[DiscordBot] No channel configured for user ${user.username} in group ${user.group}.`);
      continue;
    }

    try {
      // For simplicity in the mock flow, we always post a new message.
      const postResponse = await fetch(`https://discord.com/api/v10/channels/${targetChannelId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user.dailyShoutout),
      });

      if (postResponse.ok) {
        console.log(`[DiscordBot] Successfully posted new shoutout for ${user.username}`);
      } else {
        const error = await postResponse.text();
        console.error(`[DiscordBot] Failed to post shoutout for ${user.username}:`, error);
      }

    } catch (error) {
      console.error(`[DiscordBot] Error processing shoutout for ${user.username}:`, error);
    }
  }
}

export async function sendDiscordMessage(channelId: string, messageData: any): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error('Discord bot token not configured');
    return null;
  }
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });
    if (!response.ok) {
      const error = await response.text();
      console.error(`Discord API error sending message: ${response.status} - ${error}`);
      return null;
    }
    const result = await response.json();
    return result.id;
  } catch (error) {
    console.error('Error sending Discord message:', error);
    return null;
  }
}

export async function updateDiscordMessage(channelId: string, messageId: string, messageData: any): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messageData),
    });
    return response.ok;
  } catch (error) {
    console.error('Error updating Discord message:', error);
    return false;
  }
}

export async function deleteDiscordMessage(channelId: string, messageId: string): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return false;
  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting Discord message:', error);
    return false;
  }
}

export async function cleanupDuplicateBotMessages(channelId: string, keepIds: string[]): Promise<void> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) return;
  const botId = await getBotUserId(botToken);
  if (!botId) return;

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=50`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!response.ok) return;

    const messages = await response.json();
    const toDelete = messages
      .filter((msg: any) => msg.author.id === botId && !keepIds.includes(msg.id))
      .map((msg: any) => msg.id);

    for (const messageId of toDelete) {
      await deleteDiscordMessage(channelId, messageId);
      await new Promise(r => setTimeout(r, 300));
    }
    if (toDelete.length > 0) {
      console.log(`[DiscordBot] Cleaned up ${toDelete.length} old messages in channel ${channelId}.`);
    }
  } catch (error) {
    console.error('Error cleaning up messages:', error);
  }
}
