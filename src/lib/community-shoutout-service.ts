'use server'

import { db } from "@/firebase/server-init"
import { FieldValue } from "firebase-admin/firestore"
import { getUserByLogin, getStreamByUserId } from "./twitch-api-service"
import { generateShoutoutCardGif } from "./shoutout-card-service"
import { generateCommunityCard } from "./community-card-service"
// VIP spotlight service removed - VIP members handled with animated cards
import { addClipToPool, getRandomClipFromPool } from "./clip-management-service"
import { addCommunityCardToPool, getReusableCommunityCard } from "./community-card-pool-service"
import { getSecret } from './firestore-secrets';

async function getCommunityInviteUrl(): Promise<string | null> {
  const discordInvite = await getSecret('DISCORD_INVITE_URL');
  return process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || discordInvite || null;
}

async function buildActionButtons(
  streamerName: string,
  options: { includeInvite?: boolean; metaLabel?: string; metaUrl?: string } = {}
) {
  const { includeInvite = true } = options;

  const buttons = [
    {
      type: 2,
      style: 5,
      label: "dYs? LAUNCH MISSION",
      url: `https://twitch.tv/${streamerName}`
    }
  ];

  if (includeInvite) {
    const inviteUrl = await getCommunityInviteUrl();
    if (inviteUrl) {
      buttons.push({
        type: 2,
        style: 5,
        label: "JOIN SPACE MOUNTAIN",
        url: inviteUrl
      });
    }
  }

  return [
    {
      type: 1,
      components: buttons
    }
  ];
}

function resolveExistingMediaUrl(shoutout: any): string | null {
  if (!shoutout) return null;
  if (typeof shoutout.content === 'string' && shoutout.content.startsWith('http')) {
    return shoutout.content;
  }
  return shoutout.embeds?.[0]?.image?.url || null;
}
import { isCommunityGroupSync, isVipGroupSync } from "./group-utils";
import { getUserGroupFromRoles } from "./group-utils-server";


// Exported interface for shoutout results
export interface ShoutoutResult {
  streamerName: string
  success: boolean
  message: string
}

/**
 * Generates tailored shoutouts for all online members of the 'Community' group.
 * @param serverId The ID of the Discord server.
 * @returns A promise that resolves with an array of shoutout generation results.
 */
export async function generateAllShoutouts(serverId: string): Promise<ShoutoutResult[]> {
  const usersRef = db.collection('servers').doc(serverId).collection('users')
  const snapshot = await usersRef
    .where('isOnline', '==', true)
    .get()

  if (snapshot.empty) {
    console.log('No online users found to generate shoutouts for.')
    return [
      {
        streamerName: 'N/A',
        success: true,
        message: 'No online users found. Nothing to do!',
      },
    ]
  }

  const results: ShoutoutResult[] = []
  const batch = db.batch()

  for (const doc of snapshot.docs) {
    const user = doc.data()
    const userId = doc.id
    const streamerName = user.username
    const userLookup = { userId, username: streamerName }

    try {
      console.log('[Shoutout] Processing user:', streamerName?.replace(/[\r\n]/g, ''), '- Group:', user.group?.replace(/[\r\n]/g, ''), 'Online:', user.isOnline)
      // Check if user should be in different group based on roles
      const suggestedGroup = await getUserGroupFromRoles(user.roles || [], serverId);
      if (suggestedGroup !== user.group) {
        console.log('[Shoutout] User:', streamerName?.replace(/[\r\n]/g, ''), 'has roles suggesting:', suggestedGroup?.replace(/[\r\n]/g, ''), 'but is in:', user.group?.replace(/[\r\n]/g, ''));
      }
      
      const isVip = isVipGroupSync(user.group)
      const isCommunity = isCommunityGroupSync(user.group)
      
      // Get real Twitch data and clips
      const twitchUser = await getUserByLogin(streamerName.toLowerCase())
      const stream = twitchUser ? await getStreamByUserId(twitchUser.id) : null
      
      console.log('[Shoutout] User:', streamerName?.replace(/[\r\n]/g, ''), 'group:', user.group?.replace(/[\r\n]/g, ''), 'isVip:', isVip, 'isCommunity:', isCommunity);
      
      const now = new Date();
      const streamTitle = stream?.title || user.topic || 'Live Stream';
      const streamGame = stream?.game_name || 'Just Chatting';
      const viewerCount = stream?.viewer_count ?? 0;
      const streamThumbnail = stream?.thumbnail_url?.replace('{width}', '640').replace('{height}', '360') || '';
      const twitchAvatar = twitchUser?.profile_image_url || user.avatarUrl;
      const isLive = !!stream;
      const isMatureStream = Boolean(stream?.is_mature);
      const previousMediaUrl = resolveExistingMediaUrl(user.dailyShoutout);
      const unixSeconds = Math.floor(now.getTime() / 1000);
      const timestampIso = now.toISOString();
      const discordRelativeTime = `<t:${unixSeconds}:R>`;
      const readableTimestamp = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(now);
      
      // Handle different shoutout types
      let cardUrl: string | null = null;
      
      const freshShoutout = isShoutoutFresh(user.shoutoutGeneratedAt);

      if (isVip) {
        console.log('[Shoutout] Processing VIP user:', streamerName?.replace(/[\r\n]/g, ''), 'live:', !!stream);
        
        if (freshShoutout && previousMediaUrl) {
          cardUrl = previousMediaUrl;
          console.log('[Shoutout] Reusing fresh VIP clip for:', streamerName?.replace(/[\r\n]/g, ''));
        }
        
        if (!cardUrl) {
          // VIPs always get individual GIF clips
          const clipResult = await generateShoutoutCardGif(serverId, {
            streamerName,
            streamTitle,
            gameName: streamGame,
            viewerCount,
            avatarUrl: twitchAvatar,
            streamThumbnail,
            isLive,
            isMature: isMatureStream
          })
          
          if (clipResult) {
            cardUrl = clipResult
            console.log('[Shoutout] VIP individual GIF generated for:', streamerName?.replace(/[\r\n]/g, ''));
          } else {
            console.log('[Shoutout] VIP GIF generation failed for:', streamerName?.replace(/[\r\n]/g, ''));
          }
        }
      } else if (isCommunity) {
        const desiredTitle = streamTitle;
        const desiredGame = streamGame;

        if (freshShoutout && previousMediaUrl) {
          cardUrl = previousMediaUrl;
          console.log('[Shoutout] Reusing fresh community card for:', streamerName?.replace(/[\r\n]/g, ''));
        } else {
          // Community members get static images only
          try {
            const { generateCommunityCardImage } = await import('@/ai/flows/generate-community-card-image');
            cardUrl = await generateCommunityCardImage(serverId, streamerName, {
              title: desiredTitle,
              game: desiredGame,
              viewers: viewerCount,
              avatarUrl: twitchAvatar,
              thumbnailUrl: streamThumbnail,
              isLive
            })
            console.log('[Shoutout] Static community card generated for:', streamerName?.replace(/[\r\n]/g, ''));
          } catch (cardError) {
            console.error('[Shoutout] Community card failed for:', streamerName?.replace(/[\r\n]/g, ''), cardError instanceof Error ? cardError.message?.replace(/[\r\n]/g, '') : 'Unknown error');
            cardUrl = null;
          }
        }
      }
      
      // Different formats for different groups

      let shoutoutData;



      if (isCommunity) {

        if (cardUrl) {

          shoutoutData = {
            content: cardUrl,
            components: await buildActionButtons(streamerName, {
              includeInvite: true,
              metaLabel: `Updated ${readableTimestamp}`,
              metaUrl: cardUrl || `https://twitch.tv/${streamerName}`,
            }),
          };

        } else {

          const communityDescription = isLive

            ? `Space Cadet ${streamerName} is live with "${streamTitle}" in ${streamGame}. ${viewerCount > 0 ? `Currently holding ${viewerCount} viewers.` : 'Be the first to reinforce their mission crew.'}`

            : `Space Cadet ${streamerName} is prepping the ${streamGame} mission "${streamTitle}". Tap in to boost morale before launch.`;

          const communityFields: any[] = [

            { name: 'Game', value: streamGame, inline: true },

            { name: 'Viewers', value: viewerCount.toString(), inline: true },

            { name: 'Status', value: isLive ? 'Live Now! dYs?' : 'Standing By', inline: true },

            { name: 'Last Scan', value: discordRelativeTime, inline: true },

          ];

          if (isMatureStream) {

            communityFields.push({ name: 'Content Advisory', value: 'Mature audience stream', inline: true });

          }



          const communityEmbed: any = {

            author: {

              name: `dYs? Captain ${streamerName}`,

              url: `https://twitch.tv/${streamerName}`,

              icon_url: twitchAvatar,

            },

            title: streamTitle,

            url: `https://twitch.tv/${streamerName}`,

            description: communityDescription,

            color: 6570404,

            footer: { text: 'dYOO Space Mountain Community Member' },

            timestamp: timestampIso,

          };

          if (communityFields.length) {

            communityEmbed.fields = communityFields;

          }



          shoutoutData = {

            embeds: [communityEmbed],

            components: await buildActionButtons(streamerName, {

              includeInvite: true,

              metaLabel: `Updated ${readableTimestamp}`,

              metaUrl: `https://twitch.tv/${streamerName}`,

            }),

          };

        }

      } else if (isVip) {

        if (cardUrl) {

          shoutoutData = {
            content: cardUrl,
            components: await buildActionButtons(streamerName, {
              includeInvite: false,
              metaLabel: `Updated ${readableTimestamp}`,
              metaUrl: cardUrl || `https://twitch.tv/${streamerName}`,
            }),
          };

        } else {

          const vipDescription = isLive

            ? `Captain ${streamerName} is broadcasting "${streamTitle}" in ${streamGame}. ${viewerCount > 0 ? `Leading ${viewerCount} viewers through the mission.` : 'They could use reinforcements.'}`

            : `Captain ${streamerName} is standing by with "${streamTitle}". Rally the crew before the next sortie.`;

          const vipFields: any[] = [

            { name: 'Game', value: streamGame, inline: true },

            { name: 'Viewers', value: viewerCount.toString(), inline: true },

            { name: 'Status', value: isLive ? 'LIVE in command' : 'Off-duty prep', inline: true },

            { name: 'Last Scan', value: discordRelativeTime, inline: true },

          ];

          if (isMatureStream) {

            vipFields.push({ name: 'Content Advisory', value: 'Mature audience stream', inline: true });

          }



          const vipEmbed: any = {

            author: {

              name: `Captain ${streamerName}`,

              url: `https://twitch.tv/${streamerName}`,

              icon_url: twitchAvatar,

            },

            title: streamTitle,

            url: `https://twitch.tv/${streamerName}`,

            description: vipDescription,

            color: 9521663,

            footer: { text: 'Space Mountain Command | Honored Crew VIP' },

            timestamp: timestampIso,

          };

          if (vipFields.length) {

            vipEmbed.fields = vipFields;

          }



          shoutoutData = {

            embeds: [vipEmbed],

            components: await buildActionButtons(streamerName, {

              includeInvite: false,

              metaLabel: `Updated ${readableTimestamp}`,

              metaUrl: `https://twitch.tv/${streamerName}`,

            }),

          };

        }

      }



// Add the generated shoutout to the user's document in the batch update
      const updateData: any = {
        dailyShoutout: shoutoutData,
        shoutoutGeneratedAt: FieldValue.serverTimestamp(),
        lastTwitchData: {
          isLive: !!stream,
          updatedAt: new Date(),
        },
      }
      
      // Only add defined values to avoid Firestore errors
      if (stream?.game_name !== undefined) {
        updateData.lastTwitchData.gameTitle = stream.game_name
      }
      if (stream?.viewer_count !== undefined) {
        updateData.lastTwitchData.viewerCount = stream.viewer_count
      }
      
      batch.update(doc.ref, updateData)

      results.push({
        streamerName,
        success: true,
        message: 'Shoutout generated and saved successfully.',
      })
    } catch (error) {
      console.error('Failed to generate shoutout for:', streamerName?.replace(/[\r\n]/g, ''), error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error')
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.push({
        streamerName,
        success: false,
        message: `Failed: ${errorMessage}`,
      })
    }
  }

  // Commit all the updates at once
  await batch.commit()
  console.log('Batch update of shoutouts completed.')

  return results
}

function isShoutoutFresh(timestamp: any): boolean {
  if (!timestamp) return false;
  const date = typeof timestamp?.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
  if (!(date instanceof Date) || isNaN(date.getTime())) return false;
  const TEN_MIN = 10 * 60 * 1000;
  return Date.now() - date.getTime() < TEN_MIN;
}
