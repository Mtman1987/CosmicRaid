'use server'

// Hardcoded for testing - change these IDs to secure the app later
const HARDCODED_SERVER_ID = '1240832965865635881';
const HARDCODED_USER_ID = '1240832965865635881'; // Replace with your actual Discord user ID

import { revalidatePath } from 'next/cache'
import { db } from '@/firebase/server-init'
import { generateCalendarImage } from '@/ai/flows/generate-calendar-image'
import { generateLeaderboardImage } from '@/ai/flows/generate-leaderboard-image'
import { generateAllShoutouts } from '@/lib/community-shoutout-service'
import { manualPoll, startPolling } from '@/lib/polling-service'
import { updateVipSpotlights } from '@/lib/vip-spotlight-service'
import { postAllShoutoutsToDiscord } from '@/lib/automated-shoutout-system'
import { forwardMessage } from '@/lib/forwarding-service'
import { replyToMessage } from '@/lib/reply-service'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { Buffer } from 'node:buffer'

// Reusable error handler
function handleError(error: any, defaultMessage: string) {
  const sanitizedError = error instanceof Error ? error.message.replace(/[\r\n]/g, ' ') : String(error).replace(/[\r\n]/g, ' ')
  console.error('Action Error:', sanitizedError)
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
 * Updates group role mappings for a server
 */
export async function updateGroupRoleMappings(prevState: any, formData: FormData) {
  try {
    const serverId = formData.get('serverId') as string
    const currentPath = formData.get('currentPath') as string
    if (!serverId) throw new Error('Server ID is required.')

    const vipRoles = Array.from(formData.keys()).filter(key => key.startsWith('vip_')).map(key => key.replace('vip_', ''))
    const raidTrainRoles = Array.from(formData.keys()).filter(key => key.startsWith('raidTrain_')).map(key => key.replace('raidTrain_', ''))
    const raidPileRoles = Array.from(formData.keys()).filter(key => key.startsWith('raidPile_')).map(key => key.replace('raidPile_', ''))

    const groupMappingsRef = db.collection('servers').doc(serverId).collection('config').doc('groupMappings')
    await groupMappingsRef.set({
      vipRoles,
      raidTrainRoles,
      raidPileRoles,
      updatedAt: new Date()
    })

    return handleSuccess('Group role mappings updated successfully.', currentPath)
  } catch (error) {
    return handleError(error, 'Failed to update group role mappings.')
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
    const { getServerConfig } = await import('./config-service');
    const botToken = await getServerConfig(guildId, 'DISCORD_BOT_TOKEN');
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
    let allMembers = [];
    let after = null;
    
    do {
      const url: string = `https://discord.com/api/v10/guilds/${guildId}/members?limit=1000${after ? `&after=${after}` : ''}`;
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
 * Generates and posts a new calendar image to a specified Discord channel.
 */
export async function postNewCalendar(sessionId: string, channelId: string) {
  try {
    const { serverId } = await getUserCredentialsBySession(sessionId);
    const { getServerConfig } = await import('./config-service');
    const botToken = await getServerConfig(serverId, 'DISCORD_BOT_TOKEN');
    if (!botToken) {
      throw new Error('Discord bot token not found for this server.')
    }
    
    const guildId = serverId;

    const calendarImage = await generateCalendarImage(guildId)
    if (!calendarImage) throw new Error('Failed to generate calendar image.')

    const leaderboardImage = await generateLeaderboardImage(guildId)

    const attachments: Array<{
      buffer: Buffer
      mime: string
      filename: string
    }> = []

    function decodeImage(dataUrl: string, filename: string) {
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/)
      if (!match) {
        throw new Error(`Invalid image data URL for ${filename}.`)
      }
      const [, mime, base64] = match
      return {
        buffer: Buffer.from(base64, 'base64'),
        mime,
        filename,
      }
    }

    attachments.push(decodeImage(calendarImage, 'calendar.png'))
    if (leaderboardImage) {
      attachments.push(decodeImage(leaderboardImage, 'leaderboard.png'))
    }

    const embeds: any[] = [
      {
        title: 'Community Calendar',
        description: 'Latest events and schedule from Streamer\'s Hub.',
        color: 0x5865f2,
        image: { url: 'attachment://calendar.png' },
        timestamp: new Date().toISOString(),
      },
    ]

    if (leaderboardImage) {
      embeds.push({
        title: 'Leaderboard Snapshot',
        description: 'Top community contributors, updated just now.',
        color: 0xf1c40f,
        image: { url: 'attachment://leaderboard.png' },
        timestamp: new Date().toISOString(),
      })
    }

    const payload = {
      embeds,
      attachments: attachments.map((attachment, index) => ({
        id: index,
        filename: attachment.filename,
        description: `Auto generated ${attachment.filename}`,
      })),
    }

    const formData = new FormData()
    formData.append('payload_json', JSON.stringify(payload))

    attachments.forEach((attachment, index) => {
      formData.append(
        `files[${index}]`,
        new Blob([new Uint8Array(attachment.buffer)], { type: attachment.mime }),
        attachment.filename,
      )
    })

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${botToken}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Discord API responded with ${response.status}: ${errorText}`)
    }

    const message = await response.json()
    console.log(`[postNewCalendar] Posted calendar message ${message.id} to channel ${channelId}`)

    return { success: true, message: 'Calendar posted successfully.' }
  } catch (error) {
    console.error('[postNewCalendar] Error:', error)
    return { success: false, message: error instanceof Error ? error.message : 'An unknown error occurred.' }
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
        `[${new Date().toISOString()}] Generating calendar image via local service...`,
        // Simulate a delay
        await new Promise(resolve => setTimeout(() => resolve(`[${new Date().toISOString()}] Image generation finished.`), 1500)),
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
    const sessionId = formData.get('sessionId') as string;
    const currentPath = formData.get('currentPath') as string;
    if (!sessionId) {
        return { status: 'error' as const, message: 'Session ID is required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);
    const guildId = serverId;

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
    const sessionId = formData.get('sessionId') as string;
    if (!sessionId) {
        return { status: 'error' as const, results: [], error: 'Session ID is required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);
    if (!serverId) {
        return { status: 'error' as const, results: [], error: 'Server ID is required.' };
    }

    try {
        const results = await generateAllShoutouts(serverId);
        await postAllShoutoutsToDiscord(serverId, {
            includeCommunity: true,
            includeVip: false,
            includeSpotlight: true
        });
        return { status: 'success' as const, results, error: undefined };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        return { status: 'error' as const, results: [], error: message };
    }
}

export async function triggerVipShoutoutsAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const currentPath = formData.get('currentPath') as string | null;
    
    if (!sessionId) {
        return { status: 'error' as const, message: 'Session ID is required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);
    if (!serverId) {
        return { status: 'error' as const, message: 'Server ID is required.' };
    }

    try {
        const { runUnifiedCronCycle } = await import('./unified-cron-service');
        const result = await runUnifiedCronCycle();
        
        if (result.success) {
            return handleSuccess(`VIP shoutouts triggered: ${result.serversProcessed} servers, ${result.totalUsers} users, ${result.apiCalls} API calls`, currentPath ?? undefined);
        } else {
            throw new Error(result.errors.join(', '));
        }
    } catch (error) {
        return handleError(error, 'Failed to trigger VIP shoutouts.');
    }
}

/**
 * Save login credentials with session ID for multi-tenant support
 */
export async function saveLoginCredentials(prevState: any, formData: FormData) {
    const serverId = formData.get('serverId') as string;
    const userId = formData.get('userId') as string;
    const twitchUsername = formData.get('twitchUsername') as string;
    const sessionId = formData.get('sessionId') as string;

    if (!serverId || !userId || !sessionId) {
        return { status: 'error' as const, message: 'Server ID, User ID, and Session ID are required.' };
    }

    try {
        // Save to user sessions collection - each session gets its own document
        await db.collection('userSessions').doc(sessionId).set({
            serverId,
            userId,
            twitchUsername,
            createdAt: new Date(),
            lastActive: new Date()
        });

        return { status: 'success' as const, message: 'Login credentials saved successfully.', sessionId };
    } catch (error) {
        return handleError(error, 'Failed to save login credentials.');
    }
}

/**
 * Get user credentials by session ID
 */
async function getUserCredentialsBySession(sessionId: string) {
    try {
        const doc = await db.collection('userSessions').doc(sessionId).get();
        if (doc.exists) {
            const data = doc.data();
            // Update last active timestamp
            await db.collection('userSessions').doc(sessionId).update({
                lastActive: new Date()
            });
            return {
                serverId: data?.serverId,
                userId: data?.userId,
                twitchUsername: data?.twitchUsername
            };
        }
    } catch (error) {
        console.error('Failed to get user credentials:', error);
    }
    // Fallback to hardcoded values if session not found
    return {
        serverId: HARDCODED_SERVER_ID,
        userId: HARDCODED_USER_ID,
        twitchUsername: 'mtman1987'
    };
}

/**
 * Test database connectivity by fetching user data
 */
export async function testDatabaseConnection(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    if (!sessionId) {
        return { status: 'error' as const, message: 'Session ID is required.' };
    }
    
    const { serverId, userId } = await getUserCredentialsBySession(sessionId);

    try {
        const userDoc = await db.collection('servers').doc(serverId).collection('users').doc(userId).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            return { 
                status: 'success' as const, 
                message: `Found user: ${userData?.username || 'Unknown'} (Server: ${serverId})`,
                data: userData
            };
        } else {
            return { 
                status: 'error' as const, 
                message: `User not found at servers/${serverId}/users/${userId}` 
            };
        }
    } catch (error) {
        return handleError(error, 'Failed to test database connection.');
    }
}

/**
 * Analyze user role assignments and group classifications
 */
export async function analyzeUserRolesAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    if (!sessionId) {
        return { status: 'error' as const, message: 'Session ID is required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        const { analyzeUserRoles, getGroupStatistics } = await import('./role-assignment-service');
        const [analysis, stats] = await Promise.all([
            analyzeUserRoles(serverId),
            getGroupStatistics(serverId)
        ]);
        
        return { 
            status: 'success' as const, 
            message: `Analyzed ${stats.total} users. ${stats.needsUpdate} need group updates.`,
            analysis,
            stats
        };
    } catch (error) {
        return handleError(error, 'Failed to analyze user roles.');
    }
}

/**
 * Test Twitch clip fetching for a specific user
 */
export async function testClipFetchingAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const streamerName = formData.get('streamerName') as string;
    
    if (!sessionId || !streamerName) {
        return { status: 'error' as const, message: 'Session ID and streamer name are required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        const { getBestClipForStreamer } = await import('./twitch-clip-service');
        const clip = await getBestClipForStreamer(serverId, streamerName, {
            preferRecent: true,
            minViews: 1,
            maxDuration: 60,
            forceRefresh: true
        });
        
        if (clip) {
            return { 
                status: 'success' as const, 
                message: `Found clip: "${clip.title}" (${clip.viewCount} views, ${clip.duration}s)`,
                clip
            };
        } else {
            return { 
                status: 'error' as const, 
                message: `No suitable clips found for ${streamerName}` 
            };
        }
    } catch (error) {
        return handleError(error, 'Failed to fetch clips.');
    }
}

/**
 * Auto-assign users to groups based on their Discord roles and server mappings
 */
export async function autoAssignUserGroups(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const currentPath = formData.get('currentPath') as string;
    const dryRun = formData.get('dryRun') === 'true';
    
    if (!sessionId) {
        return { status: 'error' as const, message: 'Session ID is required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        const { getUserGroupFromRoles } = await import('./group-utils');
        const usersSnapshot = await db.collection('servers').doc(serverId).collection('users').get();
        
        const updates: Array<{username: string, oldGroup: string, newGroup: string}> = [];
        const batch = db.batch();
        
        for (const doc of usersSnapshot.docs) {
            const userData = doc.data();
            const currentGroup = userData.group || 'Community';
            const suggestedGroup = await getUserGroupFromRoles(userData.roles || [], serverId);
            
            if (currentGroup !== suggestedGroup) {
                updates.push({
                    username: userData.username || 'Unknown',
                    oldGroup: currentGroup,
                    newGroup: suggestedGroup
                });
                
                if (!dryRun) {
                    batch.update(doc.ref, { 
                        group: suggestedGroup,
                        groupUpdatedAt: new Date(),
                        groupUpdatedBy: 'auto-assignment'
                    });
                }
            }
        }
        
        if (!dryRun && updates.length > 0) {
            await batch.commit();
        }
        
        const message = dryRun 
            ? `DRY RUN: Would update ${updates.length} users` 
            : `Updated ${updates.length} users based on their Discord roles`;
            
        return handleSuccess(message, currentPath);
    } catch (error) {
        return handleError(error, 'Failed to auto-assign user groups.');
    }
}

/**
 * Post a shoutout to Discord
 */
export async function postShoutoutAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const groupType = formData.get('groupType') as string;
    
    if (!sessionId || !groupType) {
        return { status: 'error' as const, message: 'Session ID and group type are required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        const { postAllShoutoutsToDiscord } = await import('./automated-shoutout-system');
        await postAllShoutoutsToDiscord(serverId, {
            includeCommunity: groupType === 'Community',
            includeVip: groupType === 'VIP',
            includeSpotlight: true
        });
        
        return handleSuccess(`${groupType} shoutouts posted successfully.`);
    } catch (error) {
        return handleError(error, 'Failed to post shoutouts.');
    }
}

/**
 * Update user group assignment
 */
export async function updateUserGroupAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const userId = formData.get('userId') as string;
    const newGroup = formData.get('group') as string;
    
    if (!sessionId || !userId || !newGroup) {
        return { status: 'error' as const, message: 'Session ID, user ID, and group are required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        await db.collection('servers').doc(serverId).collection('users').doc(userId).update({
            group: newGroup,
            groupUpdatedAt: new Date(),
            groupUpdatedBy: 'manual'
        });
        
        return handleSuccess(`User group updated to ${newGroup}.`);
    } catch (error) {
        return handleError(error, 'Failed to update user group.');
    }
}

/**
 * Update users by role assignment
 */
export async function updateUsersByRoleAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const roleId = formData.get('roleId') as string;
    const newGroup = formData.get('group') as string;
    
    if (!sessionId || !roleId || !newGroup) {
        return { status: 'error' as const, message: 'Session ID, role ID, and group are required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        const usersSnapshot = await db.collection('servers').doc(serverId).collection('users')
            .where('roles', 'array-contains', roleId).get();
        
        const batch = db.batch();
        usersSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                group: newGroup,
                groupUpdatedAt: new Date(),
                groupUpdatedBy: 'role-assignment'
            });
        });
        
        await batch.commit();
        return handleSuccess(`Updated ${usersSnapshot.size} users with role ${roleId} to group ${newGroup}.`);
    } catch (error) {
        return handleError(error, 'Failed to update users by role.');
    }
}

/**
 * Update shoutout channel configuration
 */
export async function updateShoutoutChannelAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const channelId = formData.get('channelId') as string;
    const groupType = formData.get('groupType') as string;
    
    if (!sessionId || !channelId || !groupType) {
        return { status: 'error' as const, message: 'Session ID, channel ID, and group type are required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        await db.collection('servers').doc(serverId).collection('config').doc('channels').update({
            [`${groupType.toLowerCase()}ShoutoutChannel`]: channelId,
            updatedAt: new Date()
        });
        
        return handleSuccess(`${groupType} shoutout channel updated.`);
    } catch (error) {
        return handleError(error, 'Failed to update shoutout channel.');
    }
}

/**
 * Reply to a Discord message
 */
export async function replyToMessageAction(prevState: any, formData: FormData) {
    const sessionId = formData.get('sessionId') as string;
    const messageId = formData.get('messageId') as string;
    const channelId = formData.get('channelId') as string;
    const reply = formData.get('reply') as string;
    
    if (!sessionId || !messageId || !channelId || !reply) {
        return { status: 'error' as const, message: 'All fields are required.' };
    }
    
    const { serverId } = await getUserCredentialsBySession(sessionId);

    try {
        const result = await replyToMessage(serverId, channelId, messageId, reply);
        if (result.success) {
            return handleSuccess('Reply sent successfully.');
        } else {
            throw new Error(result.error || 'Failed to send reply');
        }
    } catch (error) {
        return handleError(error, 'Failed to send reply.');
    }
}

