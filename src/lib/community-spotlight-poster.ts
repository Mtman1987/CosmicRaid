'use server';

import { db } from '@/firebase/server-init';
import { getCurrentSpotlight } from './community-spotlight-service';

/**
 * Posts the community spotlight as a separate message to Discord
 * This appears at the bottom of the channel (first thing users see)
 */
export async function postCommunitySpotlight(serverId: string): Promise<void> {
  try {
    // Get server config for Discord settings
    const { getServerConfig } = await import('./config-service');
    const botToken = await getServerConfig(serverId, 'DISCORD_BOT_TOKEN');
    const channelId = await getServerConfig(serverId, 'COMMUNITY_CHANNEL_ID');
    
    if (!botToken || !channelId) {
      console.log(`[CommunitySpotlight] Missing Discord config for server ${serverId}`);
      return;
    }

    // Get current spotlight
    const spotlight = await getCurrentSpotlight(serverId);
    if (!spotlight) {
      console.log(`[CommunitySpotlight] No spotlight available for server ${serverId}`);
      return;
    }

    // Check if we already posted this spotlight
    const lastPostRef = db.collection('servers').doc(serverId).collection('spotlight').doc('lastPost');
    const lastPost = await lastPostRef.get();
    
    if (lastPost.exists && lastPost.data()?.streamerName === spotlight.streamerName) {
      console.log(`[CommunitySpotlight] Already posted spotlight for ${spotlight.streamerName}`);
      return;
    }

    // Create spotlight embed
    const embed = {
      title: '🌟 Community Spotlight',
      description: `Featuring ${spotlight.streamerName} - ${spotlight.streamData.title}`,
      color: 0x9146ff,
      image: { url: spotlight.cardGifUrl },
      fields: [
        { name: 'Game', value: spotlight.streamData.game, inline: true },
        { name: 'Viewers', value: spotlight.streamData.viewers.toString(), inline: true },
        { name: 'Status', value: 'Live Now!', inline: true }
      ],
      footer: { text: 'Community Spotlight rotates every 10 minutes' },
      timestamp: new Date().toISOString()
    };

    const payload = {
      embeds: [embed],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: `Watch ${spotlight.streamerName}`,
          url: `https://twitch.tv/${spotlight.streamerName}`
        }]
      }]
    };

    // Post to Discord
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const message = await response.json();
      
      // Update last post record
      await lastPostRef.set({
        streamerName: spotlight.streamerName,
        messageId: message.id,
        postedAt: new Date().toISOString()
      });
      
      console.log(`[CommunitySpotlight] Posted spotlight for ${spotlight.streamerName} (message ${message.id})`);
    } else {
      const error = await response.text();
      console.error(`[CommunitySpotlight] Discord API error: ${response.status} ${error}`);
    }

  } catch (error) {
    console.error('[CommunitySpotlight] Error posting spotlight:', error);
  }
}