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
  
  // No default - multi-tenant app requires explicit guild ID
  throw new Error('Guild ID not found - user must be logged in');
}

/**
 * Set the guild ID in a cookie (call this after login)
 */
export async function setGuildIdCookie(guildId: string) {
  const cookieStore = await cookies();
  cookieStore.set('guildId', guildId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
