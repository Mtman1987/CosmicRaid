'use server';

import { db } from '@/firebase/server-init';
import { getUserByLogin, getClipsForUser, getStreamByUserId } from './twitch-api-service';
import { convertClipToGif } from './gif-conversion-service';

interface ClipData {
  id: string;
  url: string;
  title: string;
  duration: number;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  broadcaster_name: string;
  game_name?: string;
}

interface ProcessedClip {
  clipId: string;
  clipUrl: string;
  mp4Url?: string;
  gifUrl?: string;
  title: string;
  duration: number;
  viewCount: number;
  createdAt: string;
  thumbnailUrl: string;
  streamerName: string;
  gameName?: string;
  processedAt: string;
}

export class TwitchClipService {
  private readonly CLIP_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_CLIPS_PER_USER = 10;
  private readonly PREFERRED_DURATION_MIN = 10;
  private readonly PREFERRED_DURATION_MAX = 60;

  /**
   * Get the best available clip for a streamer, with caching
   */
  async getBestClipForStreamer(
    serverId: string, 
    streamerName: string, 
    options: {
      preferRecent?: boolean;
      minViews?: number;
      maxDuration?: number;
      forceRefresh?: boolean;
    } = {}
  ): Promise<ProcessedClip | null> {
    const { preferRecent = true, minViews = 10, maxDuration = 60, forceRefresh = false } = options;
    
    try {
      // Check cache first unless forced refresh
      if (!forceRefresh) {
        const cached = await this.getCachedClip(serverId, streamerName);
        if (cached && this.isCacheValid(cached.processedAt)) {
          console.log(`[ClipService] Using cached clip for ${streamerName}`);
          return cached;
        }
      }

      // Get fresh clips from Twitch
      const twitchUser = await getUserByLogin(streamerName.toLowerCase());
      if (!twitchUser) {
        console.log(`[ClipService] Twitch user ${streamerName} not found`);
        return null;
      }

      // Get current stream info for context
      const currentStream = await getStreamByUserId(twitchUser.id);
      
      // Fetch recent clips
      const rawClips = await getClipsForUser(twitchUser.id, this.MAX_CLIPS_PER_USER);
      if (rawClips.length === 0) {
        console.log(`[ClipService] No clips found for ${streamerName}`);
        return null;
      }

      // Filter and score clips
      const scoredClips = this.scoreClips(rawClips, {
        preferRecent,
        minViews,
        maxDuration,
        currentGame: currentStream?.game_name
      });

      if (scoredClips.length === 0) {
        console.log(`[ClipService] No suitable clips found for ${streamerName}`);
        return null;
      }

      // Get the best clip
      const bestClip = scoredClips[0].clip;
      console.log(`[ClipService] Selected clip for ${streamerName}: "${bestClip.title}" (${bestClip.view_count} views)`);

      // Process the clip (convert to GIF if needed)
      const processedClip = await this.processClip(bestClip, serverId, currentStream?.game_name);
      
      // Cache the result
      if (processedClip) {
        await this.cacheClip(serverId, streamerName, processedClip);
      }

      return processedClip;

    } catch (error) {
      console.error(`[ClipService] Error getting clip for ${streamerName}:`, error);
      return null;
    }
  }

  /**
   * Score clips based on various factors
   */
  private scoreClips(
    clips: any[], 
    criteria: {
      preferRecent: boolean;
      minViews: number;
      maxDuration: number;
      currentGame?: string;
    }
  ): Array<{ clip: any; score: number }> {
    const now = Date.now();
    
    return clips
      .filter(clip => 
        clip.view_count >= criteria.minViews && 
        clip.duration <= criteria.maxDuration
      )
      .map(clip => {
        let score = 0;
        
        // Base score from view count (logarithmic to prevent outliers from dominating)
        score += Math.log10(clip.view_count + 1) * 10;
        
        // Duration preference (10-60 seconds is ideal)
        const duration = clip.duration;
        if (duration >= this.PREFERRED_DURATION_MIN && duration <= this.PREFERRED_DURATION_MAX) {
          score += 20;
        } else if (duration < this.PREFERRED_DURATION_MIN) {
          score += 10; // Short clips are still good
        } else {
          score -= 5; // Penalize very long clips
        }
        
        // Recency bonus
        if (criteria.preferRecent) {
          const ageInDays = (now - new Date(clip.created_at).getTime()) / (1000 * 60 * 60 * 24);
          if (ageInDays <= 7) {
            score += 15; // Recent clips get bonus
          } else if (ageInDays <= 30) {
            score += 5;
          }
        }
        
        // Game relevance bonus
        if (criteria.currentGame && clip.game_name === criteria.currentGame) {
          score += 25; // Big bonus for current game
        }
        
        // Title quality heuristics
        const title = clip.title.toLowerCase();
        if (title.includes('highlight') || title.includes('best') || title.includes('epic')) {
          score += 5;
        }
        if (title.includes('fail') || title.includes('death') || title.includes('rip')) {
          score += 3; // Fails can be entertaining
        }
        
        return { clip, score };
      })
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Process a clip (convert to GIF, extract metadata)
   */
  private async processClip(clip: any, serverId: string, currentGame?: string): Promise<ProcessedClip | null> {
    try {
      // Convert to GIF using existing service
      const gifUrl = await convertClipToGif(
        clip.url,
        clip.id,
        clip.broadcaster_name,
        Math.min(clip.duration, 30), // Cap at 30 seconds for GIF
        'stream',
        { serverId }
      );

      const processedClip: ProcessedClip = {
        clipId: clip.id,
        clipUrl: clip.url,
        mp4Url: clip.url, // Twitch clip URL is the MP4
        gifUrl: gifUrl || undefined,
        title: clip.title,
        duration: clip.duration,
        viewCount: clip.view_count,
        createdAt: clip.created_at,
        thumbnailUrl: clip.thumbnail_url,
        streamerName: clip.broadcaster_name,
        gameName: currentGame || clip.game_name,
        processedAt: new Date().toISOString()
      };

      return processedClip;

    } catch (error) {
      console.error(`[ClipService] Error processing clip ${clip.id}:`, error);
      return null;
    }
  }

  /**
   * Cache a processed clip
   */
  private async cacheClip(serverId: string, streamerName: string, clip: ProcessedClip): Promise<void> {
    try {
      await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .doc(streamerName.toLowerCase())
        .set(clip);
      
      console.log(`[ClipService] Cached clip for ${streamerName}`);
    } catch (error) {
      console.error(`[ClipService] Error caching clip for ${streamerName}:`, error);
    }
  }

  /**
   * Get cached clip
   */
  private async getCachedClip(serverId: string, streamerName: string): Promise<ProcessedClip | null> {
    try {
      const doc = await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .doc(streamerName.toLowerCase())
        .get();

      if (!doc.exists) {
        return null;
      }

      return doc.data() as ProcessedClip;
    } catch (error) {
      console.error(`[ClipService] Error getting cached clip for ${streamerName}:`, error);
      return null;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(processedAt: string): boolean {
    const cacheAge = Date.now() - new Date(processedAt).getTime();
    return cacheAge < this.CLIP_CACHE_DURATION;
  }

  /**
   * Get multiple clips for community spotlight rotation
   */
  async getClipsForCommunitySpotlight(
    serverId: string, 
    onlineStreamers: string[], 
    count: number = 5
  ): Promise<ProcessedClip[]> {
    const clips: ProcessedClip[] = [];
    
    // Shuffle streamers for variety
    const shuffled = [...onlineStreamers].sort(() => Math.random() - 0.5);
    
    for (const streamer of shuffled.slice(0, count * 2)) { // Get more than needed
      const clip = await this.getBestClipForStreamer(serverId, streamer, {
        preferRecent: true,
        minViews: 5, // Lower threshold for community
        maxDuration: 45
      });
      
      if (clip) {
        clips.push(clip);
      }
      
      if (clips.length >= count) {
        break;
      }
    }
    
    return clips;
  }

  /**
   * Clean up old cached clips
   */
  async cleanupOldClips(serverId: string): Promise<void> {
    try {
      const cutoff = new Date(Date.now() - this.CLIP_CACHE_DURATION * 2); // 48 hours
      
      const snapshot = await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .where('processedAt', '<', cutoff.toISOString())
        .get();

      if (snapshot.empty) {
        return;
      }

      const batch = db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`[ClipService] Cleaned up ${snapshot.size} old clips for server ${serverId}`);

    } catch (error) {
      console.error(`[ClipService] Error cleaning up clips:`, error);
    }
  }
}

// Export singleton instance
export const twitchClipService = new TwitchClipService();

// Export convenience functions
export async function getBestClipForStreamer(
  serverId: string, 
  streamerName: string, 
  options?: Parameters<TwitchClipService['getBestClipForStreamer']>[2]
) {
  return twitchClipService.getBestClipForStreamer(serverId, streamerName, options);
}

export async function getClipsForCommunitySpotlight(
  serverId: string, 
  onlineStreamers: string[], 
  count?: number
) {
  return twitchClipService.getClipsForCommunitySpotlight(serverId, onlineStreamers, count);
}

export async function cleanupOldClips(serverId: string) {
  return twitchClipService.cleanupOldClips(serverId);
}