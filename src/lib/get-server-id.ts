/**
 * Get the Discord server ID from Firestore secrets
 * This is the single source of truth for the server ID
 */

import { db } from '@/firebase/server-init';

let cachedServerId: string | null = null;

/**
 * Resolve serverId from userServerMappings/{userId} if provided; otherwise cached.
 */
export async function getServerId(userId?: string): Promise<string> {
  if (cachedServerId) return cachedServerId;
  if (!userId) throw new Error('Multi-tenant app - server ID must come from user session');
  try {
    const doc = await db.collection('userServerMappings').doc(userId).get();
    const serverId = doc.exists ? doc.data()?.serverId : undefined;
    if (!serverId) throw new Error('Server ID not found for user');
    cachedServerId = serverId;
    return serverId;
  } catch (err) {
    throw new Error('Server ID not found - user must login');
  }
}

/**
 * Client-side hook to get server ID
 * Use this in React components
 */
export function useServerId(): string {
  // For client-side, use localStorage as fallback since hooks can't be async
  const serverId = typeof window !== 'undefined' ? localStorage.getItem('discordServerId') : null;
  if (!serverId) throw new Error('Server ID not found - user must login');
  return serverId;
}

/**
 * Client-side hook to get Discord user ID
 * Use this in React components
 * TODO: Get from auth context or user session
 */
export function useUserId(): string {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('discordUserId') : null;
  if (!userId) throw new Error('User not logged in');
  return userId;
}

/**
 * Server-side helper: resolve serverId from request headers.
 * Order: x-guild-id -> x-user-id (userServerMappings) -> null.
 */
export async function resolveServerIdFromRequest(request?: Request): Promise<string | null> {
  if (!request) return null;
  const guildIdHeader = request.headers.get('x-guild-id');
  if (guildIdHeader) return guildIdHeader;
  const userIdHeader = request.headers.get('x-user-id');
  if (userIdHeader) {
    try {
      const doc = await db.collection('userServerMappings').doc(userIdHeader).get();
      return doc.exists ? (doc.data()?.serverId as string) || null : null;
    } catch {
      return null;
    }
  }
  return null;
}
