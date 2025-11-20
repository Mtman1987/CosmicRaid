/**
 * Load secrets from Firestore instead of environment variables
 * Path: servers/{serverID}/config/secrets
 */

import { db } from '@/firebase/server-init';

let cachedSecrets: Record<string, string> | null = null;
let lastFetch: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSecrets(guildId?: string, userId?: string): Promise<Record<string, string>> {
  // Return cached secrets if still valid
  if (cachedSecrets && Date.now() - lastFetch < CACHE_TTL) {
    return cachedSecrets;
  }

  try {
    let serverId = guildId;
    
    // Fallback: if no serverId but we have userId, look up from mapping
    if (!serverId && userId) {
      const { getServerIdForUser } = await import('./user-server-mapping');
      serverId = await getServerIdForUser(userId) || undefined;
      console.log(`[Firestore Secrets] Resolved serverId from userId ${userId}: ${serverId}`);
    }
    
    if (!serverId) {
      console.warn('[Firestore Secrets] No serverId provided; skipping Firestore load and using cached/env defaults');
      return cachedSecrets || {};
    }
    
    console.log(`[Firestore Secrets] Loading from path: servers/${serverId}/config/secrets`);
    
    const secretsDoc = await db
      .collection('servers')
      .doc(serverId)
      .collection('config')
      .doc('secrets')
      .get();

    if (!secretsDoc.exists) {
      console.error(`[Firestore Secrets] Document not found at servers/${serverId}/config/secrets`);
      console.error('[Firestore Secrets] Make sure this document exists in Firestore!');
      return cachedSecrets || {};
    }

    const secrets = secretsDoc.data() || {};
    
    // Cache the results
    cachedSecrets = secrets;
    lastFetch = Date.now();

    console.log(`[Firestore Secrets] Loaded ${Object.keys(secrets).length} secrets from Firestore`);
    console.log(`[Firestore Secrets] Available keys:`, Object.keys(secrets).slice(0, 10).join(', '));
    return secrets;
  } catch (error) {
    console.error('[Firestore Secrets] Error loading secrets from Firestore:', error);
    console.error('[Firestore Secrets] Returning cached secrets or empty object');
    return cachedSecrets || {};
  }
}

/**
 * Get a single secret value
 */
export async function getSecret(key: string, guildId?: string, userId?: string): Promise<string | undefined> {
  // Special-case global Discord bot token
  if (key === 'DISCORD_BOT_TOKEN') {
    try {
      const { getDiscordBotToken } = await import('./discord-bot-token');
      const token = await getDiscordBotToken();
      if (token) return token;
    } catch (err) {
      console.warn('[Firestore Secrets] Failed to load global Discord bot token fallback:', err);
    }
  }

  const secrets = await getSecrets(guildId, userId);
  return secrets[key];
}

/**
 * Merge Firestore secrets with environment variables
 * Firestore takes precedence
 */
export async function getConfig(guildId?: string, userId?: string): Promise<Record<string, string>> {
  const firestoreSecrets = await getSecrets(guildId, userId);
  const config: Record<string, string> = {
    ...process.env,
    ...firestoreSecrets,
  };

  // Ensure Discord bot token is populated even when no serverId is available
  if (!config.DISCORD_BOT_TOKEN) {
    const token = await getSecret('DISCORD_BOT_TOKEN', guildId, userId);
    if (token) {
      config.DISCORD_BOT_TOKEN = token;
    }
  }

  return config;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearSecretsCache() {
  cachedSecrets = null;
  lastFetch = 0;
}
