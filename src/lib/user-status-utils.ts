import type { UserProfile } from './types';

function toDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Standardized function to determine if a user is currently live
 * Checks both isOnline and lastTwitchData.isLive for consistency
 */
export function isUserLive(user: UserProfile): boolean {
  // Primary check: isOnline field (set by polling service)
  if (user.isOnline === true) {
    return true;
  }
  
  // Fallback check: lastTwitchData.isLive (set by Twitch API)
  if (user.lastTwitchData?.isLive === true) {
    // Only trust this if the data is recent (within last hour)
    const updatedAt = toDate(user.lastTwitchData.updatedAt);
    if (updatedAt) {
      const hourAgo = Date.now() - (60 * 60 * 1000);
      if (updatedAt.getTime() > hourAgo) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get viewer count from the most reliable source
 */
export function getUserViewerCount(user: UserProfile): number | null {
  return user.lastTwitchData?.viewerCount ?? null;
}

/**
 * Get game title from the most reliable source
 */
export function getUserGameTitle(user: UserProfile): string {
  return user.lastTwitchData?.gameTitle || 
         user.topic || 
         (user.group === 'VIP' ? 'VIP Mission' : 'Community Mission');
}

/**
 * Get stream title/topic from the most reliable source
 */
export function getUserStreamTitle(user: UserProfile): string {
  return user.topic || 'Live Stream';
}

/**
 * Check if user data is stale and needs refresh
 */
export function isUserDataStale(user: UserProfile): boolean {
  const updatedAt = toDate(user.lastTwitchData?.updatedAt);
  if (!updatedAt) return true;
  
  const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
  return updatedAt.getTime() < thirtyMinutesAgo;
}