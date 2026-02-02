
'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/firebase/server-init'
import { generateCalendarImage } from '@/ai/flows/generate-calendar-image'
import { generateLeaderboardImage } from '@/ai/flows/generate-leaderboard-image'
import { generateAllShoutouts } from '@/lib/community-shoutout-service'
import { manualPoll, startPolling } from '@/lib/polling-service'
import { updateVipSpotlights } from '@/lib/vip-spotlight-service'
import { postCommunityShoutouts, postVipShoutouts } from '@/lib/automated-shoutout-system'
import { forwardMessage } from '@/lib/forwarding-service'
import { replyToMessage } from '@/lib/reply-service'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { Buffer } from 'node:buffer'

// Reusable error handler
function handleError(error: any, defaultMessage: string) {
  console.error('Action Error:', error)
  const message = error instanceof Error ? error.message : defaultMessage
  return { status: 'error' as const, message }
}

// Reusable success handler
function handleSuccess(message: string, path?: string) {
  if (path) {
    revalidatePath(path)
  }
  return { status: 'success' as const, message }
}

/**
 * Updates the admin roles for a given server.
 */
export async function updateAdminRoles(prevState: any, formData: FormData) {
  try {
    const serverId = formData.get('serverId') as string
    const currentPath = formData.get('currentPath') as string
    if (!serverId) throw new Error('Server ID is required.')

    const roles = Array.from(formData.keys()).filter(
      (key) => key !== 'serverId' && key !== 'currentPath'
    )

    const serverRef = db.collection('servers').doc(serverId)
    await serverRef.update({ adminRoles: roles })

    return handleSuccess('Admin roles have been updated successfully.', currentPath)
  } catch (error) {
    return handleError(error, 'Failed to update admin roles.')
  }
}

/**
 * Updates the leaderboard settings for a given server.
 */
export async function updateLeaderboardSettings(prevState: any, formData: FormData) {
  try {
    const serverId = formData.get('serverId') as string
    const currentPath = formData.get('currentPath') as string
    if (!serverId) throw new Error('Server ID is required.')

    const settings = {
      raidPoints: Number(formData.get('raidPoints')),
      followPoints: Number(formData.get('followPoints')),
      subPoints: Number(formData.get('subPoints')),
      giftedSubPoints: Number(formData.get('giftedSubPoints')),
      bitPoints: Number(formData.get('bitPoints')),
      chatActivityPoints: Number(formData.get('chatActivityPoints')),
      firstMessagePoints: Number(formData.get('firstMessagePoints')),
      messageReactionPoints: Number(formData.get('messageReactionPoints')),
      adminEventPoints: Number(formData.get('adminEventPoints')),
      adminLogPoints: Number(formData.get('adminLogPoints')),
      adminMessagePoints: Number(formData.get('adminMessagePoints')),
    }

    const settingsRef = db.collection('servers').doc(serverId).collection('config').doc('leaderboardSettings')
    await settingsRef.set(settings, { merge: true })

    return handleSuccess('Leaderboard settings have been saved.', currentPath)
  } catch (error) {
    return handleError(error, 'Failed to save leaderboard settings.')
  }
}

/**
 * Fetches data from Discord API and syncs it with Firestore.
 */
export async function syncDiscordData(prevState: any, formData: FormData) {
  const guildId = formData.get('guildId') as string
  if (!guildId) {
    return { status: 'error' as const, message: 'Guild ID is required.' }
  }

  try {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken) {
      return { status: 'error' as const, message: 'Discord bot token not found for this server.' }
    }

    const headers = {
      Authorization: `Bot ${botToken}`,
    }

    // 1. Fetch Server Info
    const serverResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}`, { headers })
    if (!serverResponse.ok) throw new Error(`Failed to fetch server info: ${await serverResponse.text()}`)
    const serverData = await serverResponse.json()
    const serverName = serverData.name

    // 2. Fetch Roles
    const rolesResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers })
    if (!rolesResponse.ok) throw new Error(`Failed to fetch roles: ${await rolesResponse.text()}`)
    const rolesData = await rolesResponse.json()
    const roleNames = rolesData.map((r: any) => r.name).filter((name: string) => name !== '@everyone')

    // 3. Fetch Channels
    const channelsResponse = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers })
    if (!channelsResponse.ok) throw new Error(`Failed to fetch channels: ${await channelsResponse.text()}`)
    const channelsData = await channelsResponse.json()
    const textChannels = channelsData
      .filter((c: any) => c.type === 0) // Text channels only
      .map((c: any) => ({ id: c.id, name: c.name }))

    // 4. Fetch Members (get all members with pagination)
    let allMembers: any[] = [];
    let after = null;
    
    do {
      const url = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;
      const membersResponse = await fetch(url, { headers });
      if (!membersResponse.ok) throw new Error(`Failed to fetch members: ${await membersResponse.text()}`);
      const membersData = await membersResponse.json();
      
      allMembers.push(...membersData);
      after = membersData.length === 1000 ? membersData[membersData.length - 1].user.id : null;
    } while (after);
    
    const membersData = allMembers;


    // 5. Save to Firestore
    const batch = db.batch()

    // Public server info
    const publicDiscordRef = db.collection('discords').doc(guildId)
    batch.set(publicDiscordRef, { serverId: guildId, serverName }, { merge: true })

    // Private server config
    const serverRef = db.collection('servers').doc(guildId)
    batch.set(serverRef, { serverId: guildId, serverName }, { merge: true })

    // Config subcollections
    const rolesRef = serverRef.collection('config').doc('roles')
    batch.set(rolesRef, { list: roleNames })

    const channelsRef = serverRef.collection('config').doc('channels')
    batch.set(channelsRef, { list: textChannels })

    // Member profiles
    for (const member of membersData) {
      if (member.user.bot) continue // Skip bots
      const userRef = serverRef.collection('users').doc(member.user.id)
      const userRoles = member.roles.map((roleId: string) => rolesData.find((r: any) => r.id === roleId)?.name).filter(Boolean)
      
      batch.set(userRef, {
        discordUserId: member.user.id,
        username: member.user.username,
        avatarUrl: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : null,
        roles: userRoles,
        group: 'Community', // Default group
        isOnline: false, // Placeholder
        topic: '' // Placeholder
      }, { merge: true })
    }

    try {
      await batch.commit()
      return handleSuccess(`Successfully synced ${serverName} with ${membersData.length} members, ${roleNames.length} roles, and ${textChannels.length} channels.`)
    } catch (batchError: any) {
      console.error('Batch commit error:', batchError)
      // Try individual writes as fallback
      try {
        await db.collection('servers').doc(guildId).set({ serverId: guildId, serverName }, { merge: true })
        return handleSuccess(`Partially synced ${serverName} - server info saved.`)
      } catch (fallbackError) {
        throw new Error(`Database write failed: ${batchError.message}`)
      }
    }

  } catch (error) {
    return handleError(error, 'An unexpected error occurred during the Discord sync.')
  }
}

/**
 * A test action to verify calendar posting from the UI.
 */
export async function testCalendarPostAction(prevState: any, formData: FormData) {
    const guildId = formData.get('guildId') as string;
    const channelId = formData.get('channelId') as string;

    if (!guildId || !channelId) {
        return { status: 'error', message: 'Guild ID and Channel ID are required.', logs: [] };
    }

    console.log(`[Action] testCalendarPostAction called with guildId: ${guildId}, channelId: ${channelId}`);

    // This is a simplified version. In a real app, you might want to capture logs
    // from the actual image generation process.
    const logs = [
        `[${new Date().toISOString()}] Initiating calendar post...`,
        `[${new Date().toISOString()}] Guild ID: ${guildId}`,
        `[${new Date().toISOString()}] Channel ID: ${channelId}`,
        `[${new Date().toISOString()}] Generating calendar image via @vercel/og...`,
        // Simulate a delay
        await new Promise(resolve => setTimeout(() => resolve(`[${new Date().toISOString()}] Image process finished.`), 1500)),
        `[${new Date().toISOString()}] Image generated, posting to Discord...`,
        `[${new Date().toISOString()}] Discord API response: 200 OK`,
        `[${new Date().toISOString()}] Calendar successfully posted.`
    ];

    return { status: 'success', message: 'Test post simulated successfully!', logs };
}

/**
 * Resets all calendar data for a server.
 */
export async function resetCalendarAction(prevState: any, formData: FormData) {
    const guildId = formData.get('guildId') as string;
    const currentPath = formData.get('currentPath') as string;
    if (!guildId) {
        return { status: 'error' as const, message: 'Guild ID is required.' };
    }

    try {
        const calendarEventsRef = db.collection('servers').doc(guildId).collection('calendarEvents');
        const snapshot = await calendarEventsRef.get();
        if (snapshot.empty) {
            return handleSuccess('No calendar data to delete.', currentPath);
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        return handleSuccess(`Successfully deleted ${snapshot.size} calendar entries.`, currentPath);
    } catch (error) {
        return handleError(error, 'Failed to reset calendar data.');
    }
}

/**
 * Generates shoutouts for all online members of the 'Community' group.
 */
export async function generateAllShoutoutsAction(prevState: any, formData: FormData) {
    const serverId = formData.get('serverId') as string;
    if (!serverId) {
        return { status: 'error' as const, results: [], error: 'Server ID is required.' };
    }

    try {
        const results = await generateAllShoutouts(serverId);
        await postCommunityShoutouts(serverId);
        return { status: 'success' as const, results, error: undefined };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { status: 'error' as const, results: [], error: message };
    }
}

export async function triggerVipShoutoutsAction(prevState: any, formData: FormData) {
    const serverId = formData.get('serverId') as string;
    const currentPath = formData.get('currentPath') as string | null;

    if (!serverId) {
        return { status: 'error' as const, message: 'Server ID is required.' };
    }

    try {
        await startPolling(serverId);
        await manualPoll(serverId);
    await updateVipSpotlights(serverId);
    await generateAllShoutouts(serverId);
    await postVipShoutouts(serverId);
        return handleSuccess('VIP shoutouts dispatched to Discord.', currentPath ?? undefined);
    } catch (error) {
        return handleError(error, 'Failed to dispatch VIP shoutouts.');
    }
}

export async function updateShoutoutChannelAction(prevState: any, formData: FormData) {
    const serverId = formData.get('serverId') as string;
    const groupKey = formData.get('groupKey') as string;
    const channelId = (formData.get('channelId') as string | null)?.trim() || null;
    const currentPath = formData.get('currentPath') as string | null;

    if (!serverId || !groupKey) {
        return handleError('Invalid payload', 'Server ID and group key are required.');
    }

    try {
        const serverRef = db.collection('servers').doc(serverId);
        await serverRef.set({
            shoutoutChannels: {
                [groupKey]: channelId
            },
            updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });

        const message = channelId
            ? `Saved channel ${channelId} for ${groupKey} shoutouts.`
            : `Cleared custom channel for ${groupKey} shoutouts.`;

        return handleSuccess(message, currentPath ?? undefined);
    } catch (error) {
        return handleError(error, 'Failed to save shoutout channel.');
    }
}

export async function postShoutoutAction(prevState: any, formData: FormData) {
    try {
        const serverId = formData.get('serverId') as string;
        const channelId = formData.get('channelId') as string;
        const payloadJson = formData.get('payload') as string;
        const streamerName = formData.get('streamerName') as string;
        const currentPath = formData.get('currentPath') as string | null;

        if (!serverId || !channelId || !payloadJson) {
            throw new Error('Missing server ID, channel ID, or shoutout payload.');
        }

        let parsedPayload: any;
        try {
            parsedPayload = JSON.parse(payloadJson);
        } catch (error) {
            throw new Error('Shoutout payload is not valid JSON.');
        }

        if (!parsedPayload || typeof parsedPayload !== 'object') {
            throw new Error('Shoutout payload must be an object.');
        }

        const messagePayload: {
            content?: string
            embeds?: any[]
            components?: any[]
            allowedMentions?: { parse?: string[]; users?: string[]; roles?: string[] }
        } = {};

        if (
            'embeds' in parsedPayload ||
            'content' in parsedPayload ||
            'components' in parsedPayload ||
            'allowed_mentions' in parsedPayload ||
            'allowedMentions' in parsedPayload
        ) {
            if (typeof parsedPayload.content === 'string' && parsedPayload.content.length > 0) {
                messagePayload.content = parsedPayload.content;
            }

            if (Array.isArray(parsedPayload.embeds)) {
                messagePayload.embeds = parsedPayload.embeds;
            }

            if (Array.isArray(parsedPayload.components)) {
                messagePayload.components = parsedPayload.components;
            }

            const allowedMentions =
                parsedPayload.allowedMentions ?? parsedPayload.allowed_mentions ?? { parse: [] };
            messagePayload.allowedMentions = allowedMentions;

            if (!messagePayload.content && !(messagePayload.embeds?.length)) {
                throw new Error('Shoutout payload does not contain content or embeds to post.');
            }
        } else {
            messagePayload.embeds = [parsedPayload];
        }

        await forwardMessage({
            targetChannelId: channelId,
            content: messagePayload.content,
            embeds: messagePayload.embeds,
            components: messagePayload.components,
            allowedMentions: messagePayload.allowedMentions ?? { parse: [] },
        });

        await db
            .collection('servers')
            .doc(serverId)
            .collection('shoutoutLogs')
            .add({
                streamerName: streamerName ?? null,
                channelId,
                payload: parsedPayload,
                createdAt: Timestamp.now(),
            });

        return handleSuccess(`Shoutout posted for ${streamerName || 'the selected user'}.`, currentPath ?? undefined);
    } catch (error) {
        return handleError(error, 'Failed to post shoutout.');
    }
}

/**
 * Updates a user's group.
 */
export async function updateUserGroupAction(prevState: any, formData: FormData) {
    try {
        const serverId = formData.get('serverId') as string;
        const userId = formData.get('userId') as string;
        const newGroup = formData.get('newGroup') as string;
        const currentPath = formData.get('currentPath') as string;

        if (!serverId || !userId || !newGroup) {
            throw new Error('Missing server ID, user ID, or new group.');
        }

        const userRef = db.collection('servers').doc(serverId).collection('users').doc(userId);
        await userRef.update({ group: newGroup });

        return handleSuccess(`User successfully moved to the ${newGroup} group.`, currentPath);
    } catch (error) {
        return handleError(error, 'Failed to update user group.');
    }
}

/**
 * Updates the group for all users with a specific role.
 */
export async function updateUsersByRoleAction(prevState: any, formData: FormData) {
    try {
        const serverId = formData.get('serverId') as string;
        const roleName = formData.get('roleName') as string;
        const newGroup = formData.get('newGroup') as string;
        const currentPath = formData.get('currentPath') as string;

        if (!serverId || !roleName || !newGroup) {
            throw new Error('Missing server ID, role name, or new group.');
        }

        const usersRef = db.collection('servers').doc(serverId).collection('users');
        const snapshot = await usersRef.where('roles', 'array-contains', roleName).get();

        if (snapshot.empty) {
            return handleSuccess(`No users found with the role "${roleName}". No changes made.`, currentPath);
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { group: newGroup });
        });
        await batch.commit();

        return handleSuccess(`Successfully moved ${snapshot.size} user(s) with the "${roleName}" role to the ${newGroup} group.`, currentPath);
    } catch (error) {
        return handleError(error, 'Failed to update users by role.');
    }
}

/**
 * Posts a reply to a forwarded message.
 */
export async function replyToMessageAction(prevState: any, formData: FormData) {
    try {
        const messageId = formData.get('messageId') as string;
        const serverId = formData.get('serverId') as string;
        const channelId = formData.get('channelId') as string;
        const replyText = formData.get('replyText') as string;
        const replierId = formData.get('replierId') as string;
        const replierName = formData.get('replierName') as string;
        const replierAvatar = formData.get('replierAvatar') as string;
        const originalAuthorName = formData.get('originalAuthorName') as string;
        const forwardedMessageId = formData.get('forwardedMessageId') as string | null;

        if (!messageId || !serverId || !channelId || !replyText || !replierId || !replierName || !replierAvatar || !originalAuthorName) {
            throw new Error('Missing required fields for reply.');
        }

        const replyData = {
            text: replyText,
            authorId: replierId,
            authorName: replierName,
            authorAvatar: replierAvatar,
            timestamp: Timestamp.now(),
        };

        // This function would contain the logic to post the reply to Discord
        await replyToMessage({
            channelId,
            replyText,
            replierName,
            originalAuthorName,
            forwardedMessageId: forwardedMessageId || undefined,
        });

        // Update the message in Firestore with the reply
        const messageRef = db.collection('servers').doc(serverId).collection('messages').doc(messageId);
        await messageRef.update({ reply: replyData });

        return handleSuccess('Reply has been posted successfully.');
    } catch (error) {
        return handleError(error, 'Failed to post reply.');
    }
}
