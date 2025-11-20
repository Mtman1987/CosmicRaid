/**
 * Client-side helpers to read IDs from localStorage.
 * Server-side helpers live in get-server-id-server.ts to avoid bundling firebase-admin.
 */

export function useServerId(): string {
  const serverId = typeof window !== 'undefined' ? localStorage.getItem('discordServerId') : null;
  if (!serverId) throw new Error('Server ID not found - user must login');
  return serverId;
}

export function useUserId(): string {
  const userId = typeof window !== 'undefined' ? localStorage.getItem('discordUserId') : null;
  if (!userId) throw new Error('User not logged in');
  return userId;
}
