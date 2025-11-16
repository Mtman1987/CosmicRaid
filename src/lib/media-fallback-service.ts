'use server';

import { isFfmpegDisabled } from './runtime-env';

interface MediaOptions {
  serverId?: string;
  username: string;
  mediaType: 'gif' | 'image';
  contentType: 'spotlight' | 'vip' | 'shoutout' | 'calendar' | 'leaderboard' | 'static';
}

class MediaFallbackService {
  private freeConvertApiKey: string;
  private baseUrl = 'https://api.freeconvert.com/v1';

  constructor() {
    this.freeConvertApiKey = process.env.FREE_CONVERT_API_KEY!;
  }

  async getMediaForUser(options: MediaOptions): Promise<string | null> {
    const { username, mediaType, contentType, serverId } = options;

    // Step 1: Try local services (if available)
    if (!isFfmpegDisabled()) {
      const localResult = await this.tryLocalServices(options);
      if (localResult) return localResult;
    }

    // Step 2: Try FreeConvert API
    const freeConvertResult = await this.tryFreeConvert(options);
    if (freeConvertResult) return freeConvertResult;

    // Step 3: Check storage bucket for cached media
    const cachedResult = await this.searchStorageBucket(username, mediaType, serverId);
    if (cachedResult) return cachedResult;

    return null;
  }

  private async tryLocalServices(options: MediaOptions): Promise<string | null> {
    try {
      // Check if local Electron services are responsive on port 3300
      const healthResponse = await fetch('http://localhost:3300/api/health-check', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (!healthResponse.ok) throw new Error('Local services not available');

      // Call local service for media generation
      if (options.mediaType === 'gif') {
        const response = await fetch('http://localhost:3300/api/generate-gif', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: options.username,
            contentType: options.contentType
          }),
          signal: AbortSignal.timeout(30000)
        });
        
        if (response.ok) {
          const result = await response.json();
          return result.gifUrl;
        }
      } else {
        const response = await fetch('http://localhost:3300/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: options.username,
            contentType: options.contentType
          }),
          signal: AbortSignal.timeout(15000)
        });
        
        if (response.ok) {
          const result = await response.json();
          return result.imageUrl;
        }
      }
    } catch (error) {
      console.log('Local services unavailable, using fallbacks');
    }
    return null;
  }

  private async tryFreeConvert(options: MediaOptions): Promise<string | null> {
    try {
      if (options.mediaType === 'gif') {
        return await this.convertTwitchClipToGif(options.username);
      } else {
        return await this.takeScreenshot(options);
      }
    } catch (error) {
      console.error('FreeConvert API failed:', error);
      return null;
    }
  }

  private async convertTwitchClipToGif(username: string): Promise<string | null> {
    // Get latest Twitch clip
    const clipUrl = await this.getTwitchClipUrl(username);
    if (!clipUrl) return null;

    // Import task
    const importTask = await this.makeApiCall('/process/import/url', {
      method: 'POST',
      body: JSON.stringify({
        url: clipUrl,
        filename: `${username}_clip_${Date.now()}.mp4`
      }),
    });

    await this.waitForJobCompletion(importTask.id);

    // Convert to GIF
    const conversionTask = await this.makeApiCall('/process/convert', {
      method: 'POST',
      body: JSON.stringify({
        input: importTask.id,
        outputformat: 'gif',
        options: {
          video_codec: 'gif',
          video_resolution: '480x270',
          video_fps: 15,
          video_duration: 10,
        }
      }),
    });

    await this.waitForJobCompletion(conversionTask.id);

    // Export
    const exportTask = await this.makeApiCall('/process/export/url', {
      method: 'POST',
      body: JSON.stringify({ input: conversionTask.id }),
    });

    const completedExport = await this.waitForJobCompletion(exportTask.id);
    const tempGifUrl = completedExport.result?.url;

    if (tempGifUrl) {
      return await this.uploadToStorage(tempGifUrl, `gifs/${username}_${Date.now()}.gif`);
    }

    return null;
  }

  private async takeScreenshot(options: MediaOptions): Promise<string | null> {
    const { username, contentType } = options;
    let screenshotUrl: string;

    // Determine what to screenshot based on content type
    switch (contentType) {
      case 'calendar':
        screenshotUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/headless/calendar`;
        break;
      case 'leaderboard':
        screenshotUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/headless/leaderboard`;
        break;
      default:
        screenshotUrl = `https://twitch.tv/${username}`;
    }

    // Take screenshot using FreeConvert
    const screenshotTask = await this.makeApiCall('/process/screenshot', {
      method: 'POST',
      body: JSON.stringify({
        url: screenshotUrl,
        format: 'png',
        width: 1920,
        height: 1080,
        full_page: false
      }),
    });

    await this.waitForJobCompletion(screenshotTask.id);

    const exportTask = await this.makeApiCall('/process/export/url', {
      method: 'POST',
      body: JSON.stringify({ input: screenshotTask.id }),
    });

    const completedExport = await this.waitForJobCompletion(exportTask.id);
    const tempImageUrl = completedExport.result?.url;

    if (tempImageUrl) {
      return await this.uploadToStorage(tempImageUrl, `images/${username}_${contentType}_${Date.now()}.png`);
    }

    return null;
  }

  private async searchStorageBucket(username: string, mediaType: 'gif' | 'image', serverId?: string): Promise<string | null> {
    try {
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage().bucket();
      
      const prefix = mediaType === 'gif' ? 'gifs/' : 'images/';
      const [files] = await bucket.getFiles({
        prefix,
        maxResults: 100
      });

      // Filter files containing username
      const userFiles = files
        .filter(file => file.name.toLowerCase().includes(username.toLowerCase()))
        .sort((a, b) => {
          const aTime = a.metadata?.timeCreated || '0';
          const bTime = b.metadata?.timeCreated || '0';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

      if (userFiles.length > 0) {
        const mostRecent = userFiles[0];
        const [url] = await mostRecent.getSignedUrl({
          action: 'read',
          expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
        });
        return url;
      }
    } catch (error) {
      console.error('Error searching storage bucket:', error);
    }
    return null;
  }

  private async getTwitchClipUrl(username: string): Promise<string | null> {
    try {
      const { getTwitchUserClips } = await import('./twitch-api-service');
      const clips = await getTwitchUserClips(username, 1);
      return clips[0]?.url || null;
    } catch (error) {
      console.error('Error fetching Twitch clip:', error);
      return null;
    }
  }

  private async uploadToStorage(sourceUrl: string, storagePath: string): Promise<string> {
    const { uploadFromUrl } = await import('./firebase-storage-service');
    return await uploadFromUrl(sourceUrl, storagePath);
  }

  private async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.freeConvertApiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`FreeConvert API error: ${response.statusText}`);
    }

    return response.json();
  }

  private async waitForJobCompletion(jobId: string, maxAttempts: number = 30): Promise<any> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const job = await this.makeApiCall(`/process/${jobId}`);
      
      if (job.status === 'completed') return job;
      if (job.status === 'failed') throw new Error(`Job ${jobId} failed`);

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`Job ${jobId} timed out`);
  }
}

const mediaFallbackService = new MediaFallbackService();

export async function getMediaForUser(options: MediaOptions): Promise<string | null> {
  return mediaFallbackService.getMediaForUser(options);
}