/**
 * Load secrets from Firestore instead of environment variables
 * Path: servers/{serverID}/config/secrets
 */

import { db } from '@/firebase/server-init';

let cachedSecrets: Record<string, string> | null = null;
let lastFetch: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSecrets(): Promise<Record<string, string>> {
  // Return cached secrets if still valid
  if (cachedSecrets && Date.now() - lastFetch < CACHE_TTL) {
    return cachedSecrets;
  }

  try {
    // Get the server ID from environment or use default
    const serverId = process.env.GUILD_ID || process.env.HARDCODED_GUILD_ID || 'default';
    
    const secretsDoc = await db
      .collection('servers')
      .doc(serverId)
      .collection('config')
      .doc('secrets')
      .get();

    if (!secretsDoc.exists) {
      console.error('Secrets document not found in Firestore');
      return {};
    }

    const secrets = secretsDoc.data() || {};
    
    // Cache the results
    cachedSecrets = secrets;
    lastFetch = Date.now();

    console.log(`Loaded ${Object.keys(secrets).length} secrets from Firestore`);
    return secrets;
  } catch (error) {
    console.error('Error loading secrets from Firestore:', error);
    return cachedSecrets || {};
  }
}

/**
 * Get a single secret value
 */
export async function getSecret(key: string): Promise<string | undefined> {
  const secrets = await getSecrets();
  return secrets[key];
}

/**
 * Merge Firestore secrets with environment variables
 * Firestore takes precedence
 */
export async function getConfig(): Promise<Record<string, string>> {
  const firestoreSecrets = await getSecrets();
  
  // Merge with env vars, Firestore takes precedence
  return {
    ...process.env,
    ...firestoreSecrets,
  } as Record<string, string>;
}

/**
 * Clear the cache (useful for testing)
 */
export function clearSecretsCache() {
  cachedSecrets = null;
  lastFetch = 0;
}
