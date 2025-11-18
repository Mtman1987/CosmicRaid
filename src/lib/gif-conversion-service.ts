'use server';

import { getSecret } from './firestore-secrets';

interface ConversionJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  input_url: string;
  output_url?: string;
  created_at: string;
}

export interface GifConversionOptions {
  serverId?: string;
  fallbackGifUrl?: string;
}

class GifConversionService {
  private baseUrl = 'https://api.freeconvert.com/v1';

  private async getApiKey(serverId?: string): Promise<string> {
    if (serverId) {
      const { getServerConfig } = await import('./config-service');
      const key = await getServerConfig(serverId, 'FREE_CONVERT_API_KEY');
      if (key) return key;
    }
    
    const key = await getSecret('FREE_CONVERT_API_KEY');
    if (!key) {
      throw new Error(`FREE_CONVERT_API_KEY not found in Firestore secrets`);
    }
    return key;
  }

  private async makeApiCall(endpoint: string, serverId: string, options: RequestInit = {}): Promise<any> {
    const apiKey = await this.getApiKey(serverId);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`FreeConvert API error: ${response.statusText}`);
    }

    return response.json();
  }

  async convertClipToGif(
    clipUrl: string,
    clipId: string,
    streamerName: string,
    duration: number = 10,
    contentType: 'stream' | 'header' | 'footer' = 'stream',
    options: GifConversionOptions = {}
  ): Promise<string | null> {
    const { serverId } = options;
    
    // 1. Try local conversion service first (free, live recordings)
    try {
      const localResult = await this.tryLocalConversion(clipUrl, clipId, streamerName, duration, contentType, serverId);
      if (localResult) return localResult;
    } catch (error) {
      console.log('Local conversion service unavailable, trying FreeConvert');
    }
    
    // 2. Try FreeConvert API (costs money, uses Twitch clips)
    if (serverId) {
      try {
        const freeConvertResult = await this.convertUsingFreeConvert(clipUrl, clipId, streamerName, duration, contentType, serverId);
        if (freeConvertResult) return freeConvertResult;
      } catch (error) {
        console.error('FreeConvert failed:', error);
      }
    }
    
    // 3. Final fallback: get random GIF from storage bucket
    return await this.getRandomStorageGif(serverId);
  }
  
  private async tryLocalConversion(clipUrl: string, clipId: string, streamerName: string, duration: number, contentType: string, serverId?: string): Promise<string | null> {
    try {
      // First try ngrok tunnel URL if available
      let serviceUrl = 'http://localhost:3300';
      
      if (serverId) {
        const { getServerConfig } = await import('./config-service');
        const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
        if (tunnelUrl) {
          serviceUrl = tunnelUrl;
          console.log('[GIF] Using tunnel URL:', tunnelUrl?.replace(/[\r\n]/g, ''));
        }
      }
      
      // Check if service is available
      const healthCheck = await fetch(`${serviceUrl}/health`, { 
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      
      if (!healthCheck.ok) throw new Error('Local service not available');
      
      // Call conversion service
      const response = await fetch(`${serviceUrl}/convert-gif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipUrl, clipId, streamerName, duration, contentType }),
        signal: AbortSignal.timeout(30000)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[GIF] Local conversion successful via:', serviceUrl?.replace(/[\r\n]/g, ''));
        return result.gifUrl;
      }
    } catch (error) {
      console.log('[GIF] Local conversion failed:', error instanceof Error ? error.message?.replace(/[\r\n]/g, '') : 'Unknown error');
    }
    return null;
  }

  private async convertUsingFreeConvert(
    sourceUrl: string,
    clipId: string,
    streamerName: string,
    duration: number,
    contentType: 'stream' | 'header' | 'footer',
    serverId: string
  ): Promise<string | null> {
    const { uploadGifFromUrl, generateFileName } = await import('./firebase-storage-service');
    const fileName = await generateFileName(clipId, streamerName);
    const dimensions = this.getDimensions(contentType);

    console.log('💰 Using FreeConvert API for:', streamerName?.replace(/[\r\n]/g, ''), '(costs money)');
    
    // Create job with optimized FreeConvert API v1 settings
    const job = await this.makeApiCall('/process/jobs', serverId, {
      method: 'POST',
      body: JSON.stringify({
        tasks: {
          'import-1': {
            operation: 'import/url',
            url: sourceUrl,
            filename: `${clipId?.replace(/[\r\n]/g, '')}.mp4`
          },
          'convert-1': {
            operation: 'convert',
            input: 'import-1',
            input_format: 'mp4',
            output_format: 'gif',
            options: {
              video_codec: 'gif',
              video_resolution: `${dimensions.width}x${dimensions.height}`,
              video_fps: 12,
              video_bitrate: '500k',
              video_cut_from: '00:00:00',
              video_cut_to: `00:00:${Math.min(duration, 10).toString().padStart(2, '0')}`,
              gif_optimize: true,
              gif_dither: 'floyd_steinberg',
              gif_colors: 256,
              video_watermark_text: 'CLIP',
              video_watermark_position: 'top-left',
              video_watermark_font_size: 20,
              video_watermark_font_color: '#FFFFFF',
              video_watermark_background_color: '#000000',
              video_watermark_opacity: 0.8
            }
          },
          'export-1': {
            operation: 'export/url',
            input: 'convert-1',
            filename: fileName,
            archive_multiple_files: false
          }
        }
      })
    });

    if (!job.id) {
      throw new Error('Failed to create FreeConvert job');
    }

    const completedJob = await this.waitForJobCompletion(job.id, serverId);
    const exportTask = completedJob.tasks?.['export-1'];
    const tempGifUrl = exportTask?.result?.url;

    if (!tempGifUrl) {
      throw new Error('No GIF URL returned from FreeConvert');
    }

    const finalUrl = await uploadGifFromUrl(tempGifUrl, fileName);
    console.log('🏷️ Created watermarked CLIP GIF for:', streamerName?.replace(/[\r\n]/g, ''));
    return finalUrl;
  }

  private async uploadLocalClipForConversion(localPath: string, clipId: string, streamerName: string) {
    const fs = await import('fs');
    const buffer = await fs.promises.readFile(localPath);
    const { uploadToStorage } = await import('./firebase-storage-service');
    const storagePath = `tmp/freeconvert/${streamerName.toLowerCase()}_${clipId}_${Date.now()}.mp4`;
    const publicUrl = await uploadToStorage(buffer, storagePath, 'video/mp4');

    return {
      url: publicUrl,
      storagePath,
    };
  }

  private async cleanupTempFile(storagePath: string | null) {
    if (!storagePath) return;
    try {
      const { deleteStorageFile } = await import('./firebase-storage-service');
      await deleteStorageFile(storagePath);
    } catch (error) {
      console.error('Failed to cleanup temp storage file:', error);
    }
  }

  private async getCachedGif(streamerName: string, serverId?: string): Promise<string | null> {
    if (!serverId) return null;

    try {
      const { db } = await import('@/firebase/server-init');
      const rotationRef = db.collection('servers')
        .doc(serverId)
        .collection('gifRotation')
        .doc(`stream_${streamerName.toLowerCase()}`);
      
      const rotationDoc = await rotationRef.get();
      if (rotationDoc.exists) {
        const gifs = rotationDoc.data()?.gifs;
        if (Array.isArray(gifs) && gifs.length > 0) {
          return gifs[gifs.length - 1]?.gifUrl || null;
        }
      }

      const clipCacheDoc = await db
        .collection('servers')
        .doc(serverId)
        .collection('clipCache')
        .doc(streamerName.toLowerCase())
        .get();

      if (clipCacheDoc.exists) {
        return (clipCacheDoc.data() as any)?.gifUrl || null;
      }
    } catch (error) {
      console.error('Error fetching cached GIF from Firestore:', error);
    }

    return null;
  }

  private async waitForJobCompletion(jobId: string, serverId: string, maxAttempts: number = 40): Promise<any> {
    console.log('[FreeConvert] Waiting for job to complete:', jobId?.replace(/[\r\n]/g, ''));
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const job = await this.makeApiCall(`/process/jobs/${jobId}`, serverId);
      
      console.log('[FreeConvert] Job status:', jobId?.replace(/[\r\n]/g, ''), job.status, 'attempt:', attempt + 1 + '/' + maxAttempts);
      
      if (job.status === 'completed') {
        console.log('[FreeConvert] Job completed successfully:', jobId?.replace(/[\r\n]/g, ''));
        return job;
      }
      
      if (job.status === 'failed' || job.status === 'error') {
        const errorMsg = job.message || job.error || 'Unknown error';
        console.error('[FreeConvert] Job failed:', jobId?.replace(/[\r\n]/g, ''), errorMsg?.replace(/[\r\n]/g, ''));
        throw new Error(`FreeConvert job failed: ${errorMsg}`);
      }

      // Progressive backoff: start with 2s, increase to 5s after 10 attempts
      const delay = attempt < 10 ? 2000 : 5000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    throw new Error(`FreeConvert job ${jobId} timed out after ${maxAttempts * 3} seconds`);
  }

  // Alternative method using Shotstack API (if FreeConvert doesn't work well)
  async convertWithShotstack(clipUrl: string, clipId: string, streamerName: string): Promise<string | null> {
    try {
      const shotstackApiKey = await getSecret('SHOTSTACK_API_KEY');
      if (!shotstackApiKey) {
        throw new Error('Shotstack API key not configured');
      }

      const response = await fetch('https://api.shotstack.io/edit/stage/render', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${shotstackApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeline: {
            soundtrack: {
              src: clipUrl,
              effect: 'fadeInFadeOut'
            },
            tracks: [
              {
                clips: [
                  {
                    asset: {
                      type: 'video',
                      src: clipUrl
                    },
                    start: 0,
                    length: 10,
                    effect: 'zoomIn'
                  }
                ]
              }
            ]
          },
          output: {
            format: 'gif',
            resolution: 'sd',
            fps: 15,
            quality: 'medium'
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Shotstack API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Poll for completion
      const renderId = result.response.id;
      return await this.pollShotstackRender(renderId, shotstackApiKey);

    } catch (error) {
      console.error('Error with Shotstack conversion:', error);
      return null;
    }
  }

  private async pollShotstackRender(renderId: string, apiKey: string): Promise<string | null> {
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await fetch(`https://api.shotstack.io/edit/stage/render/${renderId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to check render status: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.response.status === 'done') {
        const tempGifUrl = result.response.url;
        
        // Upload to Firebase Storage
        const { firebaseStorage } = await import('./firebase-storage-service');
        const fileName = firebaseStorage.generateFileName(clipId, streamerName);
        const firebaseUrl = await firebaseStorage.uploadGifFromUrl(tempGifUrl, fileName);
        return firebaseUrl;
      }
      
      if (result.response.status === 'failed') {
        throw new Error(`Render failed: ${result.response.error}`);
      }

      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error('Render timed out');
  }

  private getDimensions(contentType: 'stream' | 'header' | 'footer') {
    switch (contentType) {
      case 'header':
        return { width: 960, height: 80 };
      case 'footer':
        return { width: 960, height: 60 };
      case 'stream':
      default:
        return { width: 960, height: 540 };
    }
  }

  private async convertWithLocalService(clipPath: string, clipId: string, streamerName: string, duration: number, contentType: 'stream' | 'header' | 'footer' = 'stream'): Promise<string | null> {
    const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
    if (!localServiceUrl) return null;
    
    try {
      const response = await fetch(`${localServiceUrl}/api/convert-gif`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clipPath,
          clipId,
          streamerName,
          duration,
          contentType,
          dimensions: this.getDimensions(contentType)
        })
      });
      
      if (response.ok) {
        const { gifUrl } = await response.json();
        console.log(`Local service GIF conversion completed: ${gifUrl}`);
        return gifUrl;
      }
    } catch (error) {
      console.error('Local service conversion failed, falling back to FreeConvert:', error);
    }
    return null;
  }

  // Final fallback: get random GIF from storage bucket
  private async getRandomStorageGif(serverId?: string): Promise<string | null> {
    try {
      if (!serverId) return null;
      
      const { db } = await import('@/firebase/server-init');
      
      // Try to get a random GIF from the storage bucket collection
      const gifsSnapshot = await db.collection('servers')
        .doc(serverId)
        .collection('storageGifs')
        .limit(50)
        .get();
      
      if (!gifsSnapshot.empty) {
        const randomIndex = Math.floor(Math.random() * gifsSnapshot.docs.length);
        const randomGif = gifsSnapshot.docs[randomIndex].data();
        console.log(`[GIF] Using random storage GIF: ${randomGif.url}`);
        return randomGif.url;
      }
      
      // If no storage GIFs, return null (will trigger plain embed)
      console.log('[GIF] No storage GIFs available, will use plain embed');
      return null;
      
    } catch (error) {
      console.error('Failed to get random storage GIF:', error);
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

export async function convertWithShotstack(clipUrl: string, clipId: string, streamerName: string): Promise<string | null> {
  return gifConverterService.convertWithShotstack(clipUrl, clipId, streamerName);
}

export async function getRandomStorageGif(serverId: string): Promise<string | null> {
  return gifConverterService['getRandomStorageGif'](serverId);
}
