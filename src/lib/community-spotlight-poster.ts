'use server';

import { db } from '@/firebase/server-init';
import { getCurrentSpotlight } from './community-spotlight-service';

/**
 * Generate community engagement stats for header/footer
 */
async function getCommunityStats(serverId: string) {
  try {
    // Get online users count
    const usersSnapshot = await db.collection('servers').doc(serverId).collection('users')
      .where('isOnline', '==', true).get();
    const onlineCount = usersSnapshot.size;
    
    // Get today's shoutout count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const shoutoutSnapshot = await db.collection('servers').doc(serverId).collection('users')
      .where('dailyShoutout', '!=', null).get();
    const shoutoutCount = shoutoutSnapshot.size;
    
    // Get server stats
    const serverDoc = await db.collection('servers').doc(serverId).get();
    const cycleCount = serverDoc.data()?.shoutoutCycleCount || 0;
    
    // Generate random stats messages
    const headerMessages = [
      `${onlineCount} community members are live right now!`,
      `${shoutoutCount} shoutouts shared today - keep supporting each other!`,
      `Cycle #${cycleCount} - Our community grows stronger together!`,
      `${onlineCount} streamers online - Remember to raid and support each other!`
    ];
    
    const footerMessages = [
      `Tab up, lurk, and raid fellow community members when you can!`,
      `Together we rise - ${onlineCount} strong and growing!`,
      `Community support makes us all stronger - keep it up!`,
      `Every raid, follow, and lurk helps our community thrive!`
    ];
    
    return {
      headerMessage: headerMessages[Math.floor(Math.random() * headerMessages.length)],
      footerMessage: footerMessages[Math.floor(Math.random() * footerMessages.length)],
      headerImageUrl: 'https://via.placeholder.com/800x100/8B5CF6/FFFFFF?text=COMMUNITY+SPOTLIGHT',
      footerImageUrl: 'https://via.placeholder.com/800x100/8B5CF6/FFFFFF?text=SUPPORT+EACH+OTHER'
    };
  } catch (error) {
    console.error('Error getting community stats:', error);
    return {
      headerMessage: 'Community Spotlight Time!',
      footerMessage: 'Support your fellow streamers!',
      headerImageUrl: 'https://via.placeholder.com/800x100/8B5CF6/FFFFFF?text=COMMUNITY+SPOTLIGHT',
      footerImageUrl: 'https://via.placeholder.com/800x100/8B5CF6/FFFFFF?text=SUPPORT+EACH+OTHER'
    };
  }
}

/**
 * Posts the community spotlight as a separate message to Discord
 * This appears at the bottom of the channel (first thing users see)
 */
export async function postCommunitySpotlight(serverId: string): Promise<void> {
  try {
    // Get server config for Discord settings
    const { getServerConfig } = await import('./config-service');
    const botToken = await getServerConfig(serverId, 'DISCORD_BOT_TOKEN');
    
    // Get channel ID from channels config (set via UI)
    const channelsDoc = await db.collection('servers').doc(serverId).collection('config').doc('channels').get();
    const channelId = channelsDoc.exists ? channelsDoc.data()?.communityShoutoutChannel : null;
    
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

    // Get Discord invite for Join Community button
    const { getSecret } = await import('./firestore-secrets');
    const discordInvite = process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || await getSecret('DISCORD_INVITE_URL');
    
    const payload = {
      embeds: [embed],
      components: [{
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: `Watch ${spotlight.streamerName}`,
            url: `https://twitch.tv/${spotlight.streamerName}`,
            emoji: { name: '🎮' }
          },
          ...(discordInvite ? [{
            type: 2,
            style: 5,
            label: 'Join Community',
            url: discordInvite,
            emoji: { name: '🎆' }
          }] : [])
        ]
      }]
    };

    // Get community stats for header/footer
    const stats = await getCommunityStats(serverId);
    
    // Post header image with stats
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [{
          description: `📊 **${stats.headerMessage}**`,
          color: 0x8B5CF6,
          image: { url: stats.headerImageUrl }
        }]
      })
    });

    // Post main spotlight
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    // Post footer image with stats
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        embeds: [{
          description: `🎯 **${stats.footerMessage}**`,
          color: 0x8B5CF6,
          image: { url: stats.footerImageUrl }
        }]
      })
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