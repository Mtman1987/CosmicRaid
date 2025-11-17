/**
 * Get the Discord server ID from Firestore secrets
 * This is the single source of truth for the server ID
 */

import { getSecret } from './firestore-secrets';

let cachedServerId: string | null = null;

/**
 * Get the Discord server ID from secrets
 * Returns the hardcoded guild ID from firestore-secrets.ts
 */
export async function getServerId(): Promise<string> {
  if (cachedServerId) {
    return cachedServerId;
  }

  // The server ID is hardcoded in firestore-secrets.ts
  // This is the ONLY place it should be hardcoded
  // All other code uses this function to get it
  const serverId = '1240832965865635881';
  
  cachedServerId = serverId;
  return serverId;
}

/**
 * Client-side hook to get server ID
 * Use this in React components
 */
export function useServerId(): string {
  // For now, return the hardcoded value directly on client
  // This will be replaced with a proper context provider later
  return '1240832965865635881';
}
