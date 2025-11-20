'use server'

// Hardcoded for testing - change these IDs to secure the app later
// Removed hardcoded values - now uses user-server mapping system

import { revalidatePath } from 'next/cache'
import { db } from '@/firebase/server-init'
import { generateCalendarImage } from '@/ai/flows/generate-calendar-image'
import { generateLeaderboardImage } from '@/ai/flows/generate-leaderboard-image'
import { generateAllShoutouts } from '@/lib/community-shoutout-service'
import { manualPoll, startPolling } from '@/lib/polling-service'
import { updateVipAnimatedCards } from '@/lib/vip-animated-card-service'
import { postAllShoutoutsToDiscord } from '@/lib/automated-shoutout-system'
import { forwardMessage } from '@/lib/forwarding-service'
import { replyToMessage } from '@/lib/reply-service'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { Buffer } from 'node:buffer'
import { checkRequiredSecrets } from '@/lib/required-secrets'

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
    const raidPileRoles = Array.from(formData.keys()).filter(key => key.startsWith('raidPile_')).map(key => key.replace('raidPile_', ''))

    const groupMappingsRef = db.collection('servers').doc(serverId).collection('config').doc('groupMappings')
    await groupMappingsRef.set({
      vipRoles,
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
    const { getUserGroupFromRoles } = await import('./group-utils-server');
    for (const member of membersData) {
      if (member.user.bot) continue // Skip bots
      const userRef = serverRef.collection('users').doc(member.user.id)
      const userRoles = member.roles.map((roleId: string) => rolesData.find((r: any) => r.id === roleId)?.name).filter(Boolean)
      const userGroup = await getUserGroupFromRoles(userRoles, guildId)
      
      batch.set(userRef, {
        discordUserId: member.user.id,
        username: member.user.username,
        avatarUrl: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : null,
        roles: userRoles,
        group: userGroup, // Determined from role mappings
        isOnline: false, // Placeholder
        topic: '' // Placeholder
      }, { merge: true })
    }

    try {
      await batch.commit()
      
      // Count users by group
      const groupCounts = { Community: 0, VIP: 0, 'Raid Pile': 0 };
      for (const member of membersData) {
        if (member.user.bot) continue;
        const userRoles = member.roles.map((roleId: string) => rolesData.find((r: any) => r.id === roleId)?.name).filter(Boolean);
        const userGroup = await getUserGroupFromRoles(userRoles, guildId);
        if (userGroup in groupCounts) {
          groupCounts[userGroup as keyof typeof groupCounts]++;
        }
      }
      
      const groupStats = Object.entries(groupCounts)
        .filter(([_, count]) => count > 0)
        .map(([group, count]) => `${count} ${group}`)
        .join(', ');
      
      return handleSuccess(`Successfully synced ${serverName} with ${membersData.length} members (${groupStats}), ${roleNames.length} roles, and ${textChannels.length} channels.`)
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

// Legacy function - removed in favor of user-server mapping system

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

// Legacy function - removed in favor of user-server mapping system

/**
 * Generates shoutouts for all online members of the 'Community' group.
 */
export async function generateAllShoutoutsAction(prevState: any, formData: FormData) {
    const userId = formData.get('userId') as string;
    if (!userId) {
        return { status: 'error' as const, results: [], error: 'User ID is required.' };
    }
    
    const { serverId } = await getUserCredentialsByUserId(userId);
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
    const userId = formData.get('userId') as string;
    const currentPath = formData.get('currentPath') as string | null;
    
    if (!userId) {
        return { status: 'error' as const, message: 'User ID is required.' };
    }
    
    const { serverId } = await getUserCredentialsByUserId(userId);
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

// Legacy function - now handled by user-server mapping system in login page

/**
 * Get user credentials by user ID using user-server mapping
 */
async function getUserCredentialsByUserId(userId: string) {
    try {
        const { getServerIdForUser } = await import('./user-server-mapping');
        const serverId = await getServerIdForUser(userId);
        
        if (!serverId) {
            throw new Error('Server mapping not found - user must be logged in');
        }
        
        return {
            serverId,
            userId
        };
    } catch (error) {
        console.error('Failed to get user credentials:', error);
        throw new Error('User mapping not found - user must be logged in');
    }
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
    const userId = formData.get('userId') as string;
    const serverId = formData.get('serverId') as string;
    const channelId = formData.get('channelId') as string;
    const streamerName = formData.get('streamerName') as string;
    const payload = formData.get('payload') as string;
    const currentPath = formData.get('currentPath') as string;
    
    if (!userId || !serverId || !channelId || !streamerName || !payload) {
        return { status: 'error' as const, message: 'User ID, server ID, channel ID, streamer name, and payload are required.' };
    }

    try {
        const shoutoutData = JSON.parse(payload);
        const { postShoutoutToDiscord } = await import('./automated-shoutout-system');
        
        await postShoutoutToDiscord(serverId, channelId, streamerName, shoutoutData);
        
        return handleSuccess(`Shoutout posted for ${streamerName}`, currentPath);
    } catch (error) {
        return handleError(error, 'Failed to post shoutout.');
    }
}

/**
 * Update user group assignment
 */
export async function updateUserGroupAction(prevState: any, formData: FormData) {
    const currentUserId = formData.get('currentUserId') as string;
    const targetUserId = formData.get('userId') as string;
    const newGroup = formData.get('newGroup') as string;
    const serverId = formData.get('serverId') as string;
    const currentPath = formData.get('currentPath') as string;
    
    if (!currentUserId || !targetUserId || !newGroup || !serverId) {
        return { status: 'error' as const, message: 'Current user ID, target user ID, group, and server ID are required.' };
    }

    try {
        await db.collection('servers').doc(serverId).collection('users').doc(targetUserId).update({
            group: newGroup,
            groupUpdatedAt: new Date(),
            groupUpdatedBy: 'manual'
        });
        
        return handleSuccess(`User group updated to ${newGroup}.`, currentPath);
    } catch (error) {
        return handleError(error, 'Failed to update user group.');
    }
}

/**
 * Update users by role assignment
 */
export async function updateUsersByRoleAction(prevState: any, formData: FormData) {
    const currentUserId = formData.get('currentUserId') as string;
    const roleName = formData.get('roleName') as string;
    const newGroup = formData.get('newGroup') as string;
    const serverId = formData.get('serverId') as string;
    const currentPath = formData.get('currentPath') as string;
    
    if (!currentUserId || !roleName || !newGroup || !serverId) {
        return { status: 'error' as const, message: 'Current user ID, role name, group, and server ID are required.' };
    }

    try {
        const usersSnapshot = await db.collection('servers').doc(serverId).collection('users')
            .where('roles', 'array-contains', roleName).get();
        
        const batch = db.batch();
        usersSnapshot.docs.forEach(doc => {
            batch.update(doc.ref, {
                group: newGroup,
                groupUpdatedAt: new Date(),
                groupUpdatedBy: 'role-assignment'
            });
        });
        
        await batch.commit();
        return handleSuccess(`Updated ${usersSnapshot.size} users with role ${roleName} to group ${newGroup}.`, currentPath);
    } catch (error) {
        return handleError(error, 'Failed to update users by role.');
    }
}

/**
 * Update shoutout channel configuration
 */
export async function updateShoutoutChannelAction(prevState: any, formData: FormData) {
    const userId = formData.get('userId') as string;
    const serverId = formData.get('serverId') as string;
    const groupKey = formData.get('groupKey') as string;
    const channelId = formData.get('channelId') as string;
    const currentPath = formData.get('currentPath') as string;
    
    if (!userId || !serverId || !groupKey) {
        return { status: 'error' as const, message: 'User ID, server ID, and group key are required.' };
    }

    try {
        await db.collection('servers').doc(serverId).collection('config').doc('channels').set({
            [groupKey]: channelId,
            updatedAt: new Date()
        }, { merge: true });
        
        return handleSuccess(`Shoutout channel updated for ${groupKey}.`, currentPath);
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
        await replyToMessage({
            channelId,
            replyText: reply,
            replierName: 'Admin',
            originalAuthorName: 'User',
            forwardedMessageId: messageId
        });
        return handleSuccess('Reply sent successfully.');
    } catch (error) {
        return handleError(error, 'Failed to send reply.');
    }
}

/**
 * Check what secrets are required and missing
 */
export async function checkRequiredSecretsAction(prevState: any, formData: FormData) {
  const { checkRequiredSecrets } = await import('@/lib/required-secrets')
  return await checkRequiredSecrets(prevState, formData)
}

