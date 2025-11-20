/**
 * Get Discord bot token from globalConfig/discordBot
 */

import { db } from '@/firebase/server-init';

let cachedToken: string | null = null;
let lastFetch: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getDiscordBotToken(): Promise<string | null> {
  // Return cached token if still valid
  if (cachedToken && Date.now() - lastFetch < CACHE_TTL) {
    return cachedToken;
  }

  try {
    // Try globalConfig first
    const tokenDoc = await db
      .collection('globalConfig')
      .doc('discordBot')
      .get();

    if (tokenDoc.exists) {
      const token = tokenDoc.data()?.token;
      if (token) {
        cachedToken = token;
        lastFetch = Date.now();
        console.log('[Discord Bot Token] Successfully loaded from globalConfig');
        return token;
      }
    }

    // Fallback to environment variable
    const envToken = process.env.DISCORD_BOT_TOKEN;
    if (envToken) {
      cachedToken = envToken;
      lastFetch = Date.now();
      console.log('[Discord Bot Token] Using environment variable fallback');
      return envToken;
    }

    console.error('[Discord Bot Token] No token found in globalConfig or environment');
    return null;
  } catch (error) {
    console.error('[Discord Bot Token] Error loading from Firestore:', error);
    
    // Fallback to environment variable on error
    const envToken = process.env.DISCORD_BOT_TOKEN;
    if (envToken) {
      console.log('[Discord Bot Token] Using environment fallback due to error');
      return envToken;
    }
    
    return cachedToken; // Return cached if available
  }
}