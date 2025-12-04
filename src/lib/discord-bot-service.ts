"use server";

import { getSecret } from './firestore-secrets';
import { getDiscordBotToken } from './discord-bot-token';

let cachedBotUserId: string | null = null;

async function resolveBotUserId(botToken: string): Promise<string | null> {
  if (cachedBotUserId) {
    return cachedBotUserId;
  }
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });
    if (!response.ok) {
      console.error('Failed to resolve bot identity for cleanup');
      return null;
    }
    const data = await response.json();
    cachedBotUserId = data.id;
    return cachedBotUserId;
  } catch (error) {
    console.error('Error resolving bot identity:', error);
    return null;
  }
}

// Helper function to validate Discord message content
function validateDiscordContent(messageData: any): any {
  const MAX_CONTENT_LENGTH = 4000;
  const validatedData = { ...messageData };
  
  // Check for base64 data URLs which should never be used
  if (validatedData.content && typeof validatedData.content === 'string') {
    if (validatedData.content.startsWith('data:')) {
      console.error('[Discord] Base64 data URL detected - this should use storage URLs instead');
      validatedData.content = '[Error: Image should use storage URL, not base64]';
    } else if (validatedData.content.length > MAX_CONTENT_LENGTH) {
      console.warn(`[Discord] Content too long (${validatedData.content.length} chars), truncating`);
      validatedData.content = validatedData.content.substring(0, MAX_CONTENT_LENGTH - 3) + '...';
    }
  }
  
  return validatedData;
}

export async function sendDiscordMessage(channelId: string, messageData: any, serverId?: string): Promise<string | null> {
  try {
    const botToken = await getDiscordBotToken();

    if (!botToken) {
      console.error('Discord bot token not found in globalConfig');
      return null;
    }
    
    // Validate and truncate content if necessary
    const validatedMessageData = validateDiscordContent(messageData);
    
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedMessageData),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`Discord API error: ${response.status} - ${error}`);
      return null;
    }
    
    const result = await response.json();
    console.log(`Successfully sent message to Discord channel ${channelId}`);
    return result.id;
    
  } catch (error) {
    console.error('Error sending Discord message:', error);
    return null;
  }
}

export async function updateDiscordMessage(channelId: string, messageId: string, messageData: any, serverId?: string): Promise<boolean> {
  try {
    const botToken = await getDiscordBotToken();

    if (!botToken) {
      console.error('Discord bot token not found in globalConfig');
      return false;
    }
    
    // Validate and truncate content if necessary
    const validatedMessageData = validateDiscordContent(messageData);
    
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(validatedMessageData),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`Discord API error updating message: ${response.status} - ${error}`);
      return false;
    }
    
    console.log(`Successfully updated Discord message ${messageId}`);
    return true;
    
  } catch (error) {
    console.error('Error updating Discord message:', error);
    return false;
  }
}

export async function deleteDiscordMessage(channelId: string, messageId: string, serverId?: string): Promise<boolean> {
  try {
    const botToken = await getDiscordBotToken();

    if (!botToken) {
      console.error('Discord bot token not found in globalConfig');
      return false;
    }
    
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`Discord API error deleting message: ${response.status} - ${error}`);
      return false;
    }
    
    console.log(`Successfully deleted Discord message ${messageId}`);
    return true;
    
  } catch (error) {
    console.error('Error deleting Discord message:', error);
    return false;
  }
}

export async function cleanupDuplicateBotMessages(channelId: string, keepMessageIds: string[], serverId?: string): Promise<void> {
  try {
    const botToken = await getDiscordBotToken();

    if (!botToken) {
      console.error('Discord bot token not found in globalConfig');
      return;
    }
    const botId = await resolveBotUserId(botToken);
    if (!botId) {
      console.warn('Unable to determine bot user id; skipping duplicate cleanup');
      return;
    }
    
    // Get recent messages from the channel
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=50`, {
      headers: {
        'Authorization': `Bot ${botToken}`,
      },
    });
    
    if (!response.ok) {
      console.error('Failed to fetch channel messages for cleanup');
      return;
    }
    
    const messages = await response.json();
    
    // Find bot messages that aren't in the keep list
    const messagesToDelete = messages
      .filter((msg: any) => msg.author.id === botId && !keepMessageIds.includes(msg.id))
      .map((msg: any) => msg.id);
    
    // Delete old bot messages
    for (const messageId of messagesToDelete) {
      await deleteDiscordMessage(channelId, messageId);
      await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit protection
    }
    
    if (messagesToDelete.length > 0) {
      console.log(`[Cleanup] Deleted ${messagesToDelete.length} duplicate bot messages`);
    }
    
  } catch (error) {
    console.error('Error cleaning up duplicate messages:', error);
  }
}
