'use server';

import { db } from '@/firebase/server-init';

const serverConfigCache = new Map<string, Record<string, string>>();
const lastFetchMap = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getServerConfig(serverId: string, key: string): Promise<string | undefined> {
  const lastFetch = lastFetchMap.get(serverId) || 0;
  
  if (Date.now() - lastFetch > CACHE_TTL) {
    await loadServerConfig(serverId);
  }
  
  // Prioritize environment variables (from secrets manager or .env)
  const envValue = process.env[key];
  if (envValue) {
    return envValue;
  }

  // Fallback to server config from Firestore
  const serverConfig = serverConfigCache.get(serverId) || {};
  const value = serverConfig[key];
  
  if (!value) {
    console.warn(`[ConfigService] Config key '${key}' not found for server ${serverId} in ENV or Firestore.`);
  }
  
  return value;
}

export async function loadServerConfig(serverId: string): Promise<void> {
  try {
    console.log(`[ConfigService] Loading config for server ${serverId}...`);
    const secretsDoc = await db.collection('servers').doc(serverId).collection('config').doc('secrets').get();
    
    if (!secretsDoc.exists) {
      console.warn(`[ConfigService] No secrets document found for server ${serverId}.`);
      return;
    }
    
    const configData = secretsDoc.data() || {};
    serverConfigCache.set(serverId, configData);
    lastFetchMap.set(serverId, Date.now());
    
    console.log(`[ConfigService] Successfully loaded and cached ${Object.keys(configData).length} secrets for server ${serverId}.`);

  } catch (error) {
    console.error(`[ConfigService] Failed to load config for server ${serverId}:`, error);
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
