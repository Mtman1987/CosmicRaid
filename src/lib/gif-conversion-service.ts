'use server';



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
    // Use environment variable directly - apphosting.yaml should provide it
    const key = process.env.FREE_CONVERT_API_KEY;
    if (!key) {
      throw new Error(`FREE_CONVERT_API_KEY environment variable not found`);
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
    const { serverId, fallbackGifUrl } = options;
    const { getMediaForUser } = await import('./media-fallback-service');
    
    // Use the new centralized fallback service
    return getMediaForUser({
      username: streamerName,
      mediaType: 'gif',
      contentType: contentType === 'stream' ? 'spotlight' : contentType,
      serverId
    });
  }
  
  private async tryLocalConversion(clipUrl: string, clipId: string, streamerName: string, duration: number, contentType: string): Promise<string | null> {
    try {
      // Check if local service is running on port 3300
      const healthCheck = await fetch('http://localhost:3300/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      if (!healthCheck.ok) throw new Error('Local service not available');
      
      // Call local conversion service
      const response = await fetch('http://localhost:3300/convert-gif', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipUrl, clipId, streamerName, duration, contentType }),
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      if (response.ok) {
        const result = await response.json();
        return result.gifUrl;
      }
    } catch (error) {
      // Local service not available, that's fine
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

    console.log(`💰 Using FreeConvert API for ${streamerName} (costs money)`);
    
    // Create job with new jobs API
    const job = await this.makeApiCall('/process/jobs', serverId, {
      method: 'POST',
      body: JSON.stringify({
        tasks: {
          'import-1': {
            operation: 'import/url',
            url: sourceUrl
          },
          'convert-1': {
            operation: 'convert',
            input: 'import-1',
            input_format: 'mp4',
            output_format: 'gif',
            options: {
              cut_start_video_to_gif: '00:00:00.00',
              cut_end_gif: `00:00:${Math.min(duration, 10).toString().padStart(2, '0')}.00`,
              video_custom_width_gif: dimensions.width,
              video_to_gif_transparency: false,
              gif_fps: '15',
              video_to_gif_compression: '15',
              video_to_gif_optimize_static_bg: false,
              video_watermark_text: 'CLIP',
              video_watermark_position: 'top-left',
              video_watermark_font_size: 24,
              video_watermark_font_color: 'white',
              video_watermark_background_color: 'black',
              video_watermark_opacity: 0.8
            }
          },
          'export-1': {
            operation: 'export/url',
            input: ['convert-1'],
            filename: fileName
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
    console.log(`🏷️ Created watermarked CLIP GIF for ${streamerName}`);
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

  private async waitForJobCompletion(jobId: string, serverId: string, maxAttempts: number = 30): Promise<any> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const job = await this.makeApiCall(`/process/jobs/${jobId}`, serverId);
      
      if (job.status === 'completed') {
        return job;
      }
      
      if (job.status === 'failed' || job.status === 'error') {
        throw new Error(`Job ${jobId} failed: ${job.message || 'Unknown error'}`);
      }

      // Wait 3 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    throw new Error(`Job ${jobId} timed out after ${maxAttempts} attempts`);
  }

  // Alternative method using Shotstack API (if FreeConvert doesn't work well)
  async convertWithShotstack(clipUrl: string, clipId: string, streamerName: string): Promise<string | null> {
    try {
      const shotstackApiKey = process.env.SHOTSTACK_API_KEY;
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
      return await this.pollShotstackRender(renderId, shotstackApiKey, clipId, streamerName);

    } catch (error) {
      console.error('Error with Shotstack conversion:', error);
      return null;
    }
  }

  private async pollShotstackRender(renderId: string, apiKey: string, clipId: string, streamerName: string): Promise<string | null> {
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
        const { uploadGifFromUrl, generateFileName } = await import('./firebase-storage-service');
        const fileName = await generateFileName(clipId, streamerName);
        const firebaseUrl = await uploadGifFromUrl(tempGifUrl, fileName);
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

  private async convertWithFFmpeg(clipPath: string, clipId: string, streamerName: string, duration: number, contentType: 'stream' | 'header' | 'footer' = 'stream'): Promise<string | null> {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const os = await import('os');
      const fs = await import('fs');
      const tempDir = os.tmpdir();
      const tempGif = `${tempDir}/${clipId}.gif`;
      
      // Check if input file exists
      if (!fs.existsSync(clipPath)) {
        throw new Error(`Input MP4 file not found: ${clipPath}`);
      }
      
      // Convert MP4 to GIF with FFmpeg (optimized for small file size)
      console.log('Converting MP4 to GIF with FFmpeg...');
      const dimensions = this.getDimensions(contentType);
      const paletteFile = `${tempDir}/palette_${clipId}.png`;
      const ffmpegCmd = `ffmpeg -i "${clipPath}" -vf "fps=10,scale=${dimensions.width}:${dimensions.height}:flags=lanczos,palettegen" -frames:v 1 -y "${paletteFile}" && ffmpeg -i "${clipPath}" -i "${paletteFile}" -t ${duration} -filter_complex "[0:v]fps=10,scale=${dimensions.width}:${dimensions.height}:flags=lanczos[v];[v][1:v]paletteuse" -y "${tempGif}"`;
      
      await execAsync(ffmpegCmd);
      
      // Upload to Firebase Storage
      const gifBuffer = fs.readFileSync(tempGif);
      const base64Gif = `data:image/gif;base64,${gifBuffer.toString('base64')}`;
      
      const { uploadGifFromUrl, generateFileName } = await import('./firebase-storage-service');
      const fileName = await generateFileName(clipId, streamerName);
      const firebaseUrl = await uploadGifFromUrl(base64Gif, `gifs/${fileName}.gif`);
      
      // Cleanup temp files
      try {
        fs.unlinkSync(tempGif);
        fs.unlinkSync(paletteFile);
      } catch (e) {}
      
      console.log(`FFmpeg GIF conversion completed: ${firebaseUrl}`);
      return firebaseUrl;
      
    } catch (error) {
      console.error('FFmpeg conversion failed, falling back to FreeConvert:', error);
      return null;
    }
  }

  // Simple fallback: just use the clip thumbnail as a "GIF"
  getThumbnailAsGif(thumbnailUrl: string): string {
    // Twitch thumbnails are static images, but we can use them as fallback
    return thumbnailUrl.replace('%{width}', '480').replace('%{height}', '270');
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

export async function getThumbnailAsGif(thumbnailUrl: string): Promise<string> {
  return gifConverterService.getThumbnailAsGif(thumbnailUrl);
}
