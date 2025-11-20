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
  throw new Error('Multi-tenant app - server ID must come from user session');
}

/**
 * Client-side hook to get server ID
 * Use this in React components
 */
export function useServerId(): string {
  // For client-side, still use localStorage as fallback since hooks can't be async
  // The user-server mapping is used on the server-side in actions
  const serverId = localStorage.getItem('discordServerId');
  if (!serverId) throw new Error('Server ID not found - user must login');
  return serverId;
}

/**
 * Client-side hook to get Discord user ID
 * Use this in React components
 * TODO: Get from auth context or user session
 */
export function useUserId(): string {
  const userId = localStorage.getItem('discordUserId');
  if (!userId) throw new Error('User not logged in');
  return userId;
}
