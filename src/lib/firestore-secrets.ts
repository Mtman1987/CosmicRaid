/**
 * Load secrets from Firestore instead of environment variables
 * Path: servers/{serverID}/config/secrets
 */

import { db } from '@/firebase/server-init';

let cachedSecrets: Record<string, string> | null = null;
let lastFetch: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSecrets(guildId?: string): Promise<Record<string, string>> {
  // Return cached secrets if still valid
  if (cachedSecrets && Date.now() - lastFetch < CACHE_TTL) {
    return cachedSecrets;
  }

  try {
    // HARDCODED GUILD ID - NO DEPENDENCIES
    const serverId = '1240832965865635881';
    
    console.log(`[Firestore Secrets] Loading from: servers/${serverId}/config/secrets`);
    
    const secretsDoc = await db
      .collection('servers')
      .doc(serverId)
      .collection('config')
      .doc('secrets')
      .get();

    if (!secretsDoc.exists) {
      console.error(`[Firestore Secrets] Document not found at servers/${serverId}/config/secrets`);
      return {};
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
export async function getSecret(key: string): Promise<string | undefined> {
  const secrets = await getSecrets();
  return secrets[key];
}

/**
 * Merge Firestore secrets with environment variables
 * Firestore takes precedence
 */
export async function getConfig(guildId?: string): Promise<Record<string, string>> {
  const firestoreSecrets = await getSecrets(guildId);
  
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
