'use server';

import { freeConvertService } from './community-spotlight-serverside-fallback';
import { getClipsForUser as getTwitchClips } from './twitch-api-service';

export interface GifConversionOptions {
  serverId?: string;
  fallbackGifUrl?: string;
}

/**
 * Converts a Twitch clip to a GIF.
 * This service is now hardwired to use the FreeConvert API directly,
 * bypassing local Puppeteer and other complex fallback mechanisms for simplicity.
 */
class GifConversionService {
  /**
   * Main function to convert a clip. It finds the latest clip for a user
   * and processes it using the FreeConvert API.
   */
  async convertClipToGif(
    clipUrl: string, // Kept for signature compatibility, but will be replaced by fresh clip
    clipId: string, // Kept for signature compatibility
    streamerName: string,
    duration: number = 10,
    contentType: 'stream' | 'header' | 'footer' = 'stream',
    options: GifConversionOptions = {}
  ): Promise<string | null> {
    const { serverId } = options;

    if (!serverId) {
      console.error('[GifConversion] Server ID is required to use the FreeConvert API.');
      return null;
    }
    
    try {
        console.log(`[GifConversion] Hardwired to FreeConvert. Fetching latest clip for ${streamerName}.`);
        const latestClip = await this.getLatestTwitchClip(streamerName);

        if (!latestClip) {
            console.warn(`[GifConversion] No recent clips found for ${streamerName}. Cannot convert to GIF.`);
            return null;
        }

        const gifBuffer = await freeConvertService.convertVideoUrlToGif(latestClip.mp4Url);

        if (!gifBuffer) {
            throw new Error('GIF conversion via FreeConvert returned an empty buffer.');
        }

        const { uploadToStorage } = await import('./firebase-storage-service');
        const fileName = `gifs/${streamerName}_${latestClip.id}_${Date.now()}.gif`;
        const firebaseUrl = await uploadToStorage(gifBuffer, fileName, 'image/gif');

        console.log(`[GifConversion] Successfully converted clip and uploaded to ${firebaseUrl}`);
        return firebaseUrl;

    } catch (error) {
        console.error(`[GifConversion] Failed to process GIF for ${streamerName}:`, error);
        return null; // Return null on any failure in the chain
    }
  }

  /**
   * Fetches the most recent clip for a user and derives its MP4 URL.
   */
  private async getLatestTwitchClip(username: string): Promise<{id: string, url: string, mp4Url: string} | null> {
    try {
      const clips = await getTwitchClips(username, 1);
      if (!clips || clips.length === 0) {
        return null;
      }
      const clip = clips[0];
      const mp4Url = clip.thumbnail_url.replace(/-preview-\d+x\d+\.jpg$/, '.mp4');
      return { id: clip.id, url: clip.url, mp4Url };
    } catch (error) {
      console.error(`[GifConversion] Could not fetch latest clip for ${username}:`, error);
      return null;
    }
  }
}

const gifConverterService = new GifConversionService();

export async function convertClipToGif(
  clipUrl: string,
  clipId: string,
  streamerName: string,
  duration: number = 10,
  contentType: 'stream' | 'header' | 'footer' = 'stream',
  options: GifConversionOptions = {}
): Promise<string | null> {
  return gifConverterService.convertClipToGif(clipUrl, clipId, streamerName, duration, contentType, options);
}
