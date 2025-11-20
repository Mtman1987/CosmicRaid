import { db } from '@/firebase/server-init';

let cachedServerId: string | null = null;

export async function getServerId(userId?: string): Promise<string> {
  if (cachedServerId) return cachedServerId;
  if (!userId) throw new Error('Multi-tenant app - server ID must come from user session');
  const doc = await db.collection('userServerMappings').doc(userId).get();
  const serverId = doc.exists ? (doc.data()?.serverId as string | undefined) : undefined;
  if (!serverId) throw new Error('Server ID not found for user');
  cachedServerId = serverId;
  return serverId;
}

/**
 * Resolve serverId from request headers.
 * Order: x-guild-id -> x-user-id (userServerMappings) -> null.
 */
export async function resolveServerIdFromRequest(request?: Request): Promise<string | null> {
  if (!request) return null;
  const guildIdHeader = request.headers.get('x-guild-id');
  if (guildIdHeader) return guildIdHeader;
  const userIdHeader = request.headers.get('x-user-id');
  if (userIdHeader) {
    const doc = await db.collection('userServerMappings').doc(userIdHeader).get();
    return doc.exists ? (doc.data()?.serverId as string) || null : null;
  }
  return null;
}
