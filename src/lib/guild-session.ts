/**
 * Get guild ID from authenticated user's session or cookies
 */

import { cookies } from 'next/headers';

/**
 * Get the guild ID for the current request
 * Priority: Cookie > Header > Default
 */
export async function getGuildIdFromRequest(request?: Request): Promise<string> {
  // Try to get from cookie first
  const cookieStore = await cookies();
  const guildIdCookie = cookieStore.get('guildId');
  
  if (guildIdCookie?.value) {
    return guildIdCookie.value;
  }
  
  // Try to get from request header
  if (request) {
    const guildIdHeader = request.headers.get('x-guild-id');
    if (guildIdHeader) {
      return guildIdHeader;
    }
  }
  
  // Default to hardcoded guild ID
  return '1240832965865635881';
}

/**
 * Set the guild ID in a cookie (call this after login)
 */
export function setGuildIdCookie(guildId: string) {
  const cookieStore = cookies();
  cookieStore.set('guildId', guildId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
