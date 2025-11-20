'use server';

import { db } from '@/firebase/server-init';

const serverConfigCache = new Map<string, Record<string, string>>();
const lastFetchMap = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getServerConfig(serverId: string, key: string): Promise<string | undefined> {
  // Special case: Discord bot token is global
  if (key === 'DISCORD_BOT_TOKEN') {
    const { getDiscordBotToken } = await import('./discord-bot-token');
    return await getDiscordBotToken() || undefined;
  }
  
  const lastFetch = lastFetchMap.get(serverId) || 0;
  
  if (Date.now() - lastFetch > CACHE_TTL) {
    await loadServerConfig(serverId);
  }
  
  // Prioritize environment variables (from secrets manager or .env), then server config from Firestore
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }

  const serverConfig = serverConfigCache.get(serverId) || {};
  const value = serverConfig[key];
  
  if (!value) {
    console.warn(`Config key '${key}' not found for server ${serverId}`);
  }
  
  return value;
}

async function loadServerConfig(serverId: string) {
  try {
    const secretsDoc = await db.collection('servers').doc(serverId).collection('config').doc('secrets').get();
    if (secretsDoc.exists) {
      serverConfigCache.set(serverId, secretsDoc.data() || {});
      lastFetchMap.set(serverId, Date.now());
    }
  } catch (error) {
    console.error(`Failed to load config for server ${serverId}:`, error);
  }
}

export async function setServerConfig(serverId: string, key: string, value: string): Promise<void> {
  await db.collection('servers').doc(serverId).collection('config').doc('secrets').set({
    [key]: value
  }, { merge: true });
  
  // Update cache
  const serverConfig = serverConfigCache.get(serverId) || {};
  serverConfig[key] = value;
  serverConfigCache.set(serverId, serverConfig);
}