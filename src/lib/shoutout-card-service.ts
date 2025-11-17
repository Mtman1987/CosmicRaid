'use server';

import puppeteer from 'puppeteer';
import { uploadGifFromUrl } from './firebase-storage-service';
import { convertClipToGif } from './gif-conversion-service';
import { getSecret } from './firestore-secrets';
// Note: You'll need to install: npm install puppeteer-screen-recorder
// import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

interface ShoutoutCardData {
  streamerName: string;
  streamTitle: string;
  gameName: string;
  viewerCount: number;
  avatarUrl: string;
  streamThumbnail: string;
  isLive: boolean;
  isMature?: boolean;
}

export async function generateShoutoutCardGif(
  cardData: ShoutoutCardData,
  serverId: string
): Promise<{ gifUrl: string; mp4Url: string } | null> {
  // Check GIF rotation system - 6 new GIFs in first hour, then cycle through them
  const { db } = await import('@/firebase/server-init');
  const rotationRef = db.collection('servers').doc(serverId).collection('gifRotation').doc(`stream_${cardData.streamerName.toLowerCase()}`);
  const rotationDoc = await rotationRef.get();
  
  if (rotationDoc.exists) {
    const data = rotationDoc.data();
    const sessionStart = data?.sessionStart?.toMillis();
    const gifCount = data?.gifCount || 0;
    const gifs = data?.gifs || [];
    const lastGenerated = data?.lastGenerated?.toMillis();
    
    if (sessionStart && (Date.now() - sessionStart) < (24 * 60 * 60 * 1000)) { // Same session (24h)
      if (gifCount < 6) {
        // Still generating first 6 GIFs, check 10-minute cooldown
        if (lastGenerated && (Date.now() - lastGenerated) < (9 * 60 * 1000)) {
          // Within cooldown, use most recent GIF but don't generate new one
          const currentGif = gifs[gifs.length - 1];
          if (currentGif) {
            console.log(`[ClipManager] Reusing cached clip ${gifCount}/6 for ${cardData.streamerName} (9min cooldown)`);
            return { gifUrl: currentGif.gifUrl, mp4Url: currentGif.mp4Url };
          }
        }
        // Cooldown expired or no previous GIF, generate new GIF (#1-6)
        console.log(`[ClipManager] Generating new GIF ${gifCount + 1}/6 for ${cardData.streamerName}`);
      } else {
        // Have all 6 GIFs, rotate through them every 10 minutes
        const rotationIndex = Math.floor((Date.now() - sessionStart) / (10 * 60 * 1000)) % 6;
        const selectedGif = gifs[rotationIndex];
        if (selectedGif) {
          console.log(`[ClipManager] Reusing cached clip ${rotationIndex + 1}/6 for ${cardData.streamerName}`);
          return { gifUrl: selectedGif.gifUrl, mp4Url: selectedGif.mp4Url };
        }
      }
    }
  }
  
  const appUrl = await getSecret('BASE_URL') || 'http://localhost:3001';
  const cardUrl = `${appUrl}/headless/shoutout-card/${serverId}?${new URLSearchParams({
    streamer: cardData.streamerName,
    title: cardData.streamTitle,
    game: cardData.gameName,
    viewers: cardData.viewerCount.toString(),
    avatar: cardData.avatarUrl,
    thumbnail: cardData.streamThumbnail,
    live: cardData.isLive.toString(),
    mature: (cardData.isMature ?? false).toString()
  })}`;
  const isMatureStream = Boolean(cardData.isMature);

  let browser;
  try {
    console.log(`[Puppeteer] Launching browser for shoutout card: ${cardData.streamerName}`);
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ],
    });

    const page = await browser.newPage();
    await page.setViewport({
      width: 960,
      height: 540,
      deviceScaleFactor: 1,
    });

    console.log(`[Puppeteer] Navigating to ${cardUrl}`);
    await page.goto(cardUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });

    // Wait for card to load
    try {
      await page.waitForSelector('main', { timeout: 15000 });
    } catch (e) {
      console.log('[Puppeteer] Main selector timeout, proceeding anyway');
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    const timestamp = Date.now();
    
    // Try multiple approaches to start the stream
    console.log(`[Puppeteer] Attempting to start stream for ${cardData.streamerName}`);
    
    // Approach 1: Try clicking on the iframe area to trigger interaction
    try {
      // Wait for iframe to load
      await page.waitForSelector('iframe', { timeout: 10000 });
      
      // Click on the iframe to focus it and trigger autoplay
      await page.click('iframe');
      console.log(`[Puppeteer] Clicked on Twitch iframe to trigger autoplay`);
      
      // Wait a bit for autoplay to start
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Try to access iframe content if possible
      const iframe = await page.$('iframe');
      if (iframe) {
        try {
          const frame = await iframe.contentFrame();
          if (frame) {
            // Handle mature content gate (always check, not just when isMatureStream is true)
            const matureSelectors = [
              '[data-a-target="content-classification-gate-overlay-start-watching-button"]',
              'button[data-a-target="content-classification-gate-overlay-start-watching-button"]',
              '[data-a-target="content-classification-gate-overlay-accept-button"]',
              'button[data-a-target="content-classification-gate-overlay-accept-button"]',
              '[data-test-selector="mature-accept-button"]',
              '.content-classification-gate__start-watching button',
              'button:contains("Start Watching")',
              'button:contains("Accept")',
              'button.tw-button--primary',
              'button.tw-button'
            ];
            
            let matureGateCleared = false;
            for (const selector of matureSelectors) {
              try {
                await frame.waitForSelector(selector, { timeout: 2000 });
                await frame.click(selector);
                console.log(`[Puppeteer] Cleared mature content gate with selector: ${selector}`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                matureGateCleared = true;
                break;
              } catch {
                // continue to next selector
              }
            }
            
            // If mature gate was cleared, wait a bit more and try again for any additional gates
            if (matureGateCleared) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              for (const selector of matureSelectors) {
                try {
                  const element = await frame.$(selector);
                  if (element) {
                    await frame.click(selector);
                    console.log(`[Puppeteer] Cleared additional mature content gate with selector: ${selector}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                  }
                } catch {
                  // continue
                }
              }
            }
            
            // Try multiple selectors for play button
            const playSelectors = [
              '[data-a-target="player-play-pause-button"]',
              'button[aria-label="Play"]',
              '.player-button--play',
              '[data-test-selector="play-pause-button"]',
              'button[data-a-target="player-play-pause-button"]'
            ];
            
            let playButtonClicked = false;
            for (const selector of playSelectors) {
              try {
                await frame.waitForSelector(selector, { timeout: 1000 });
                await frame.click(selector);
                console.log(`[Puppeteer] Play button clicked with selector: ${selector}`);
                playButtonClicked = true;
                break;
              } catch (e) {
                // Continue to next selector
              }
            }
            
            // After clicking play, check again for mature content gates that might appear
            if (playButtonClicked) {
              await new Promise(resolve => setTimeout(resolve, 2000));
              for (const selector of matureSelectors) {
                try {
                  const element = await frame.$(selector);
                  if (element) {
                    await frame.click(selector);
                    console.log(`[Puppeteer] Cleared post-play mature content gate with selector: ${selector}`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Try clicking play again after clearing mature gate
                    for (const playSelector of playSelectors) {
                      try {
                        const playElement = await frame.$(playSelector);
                        if (playElement) {
                          await frame.click(playSelector);
                          console.log(`[Puppeteer] Re-clicked play button after mature gate: ${playSelector}`);
                          break;
                        }
                      } catch {
                        // continue
                      }
                    }
                    break;
                  }
                } catch {
                  // continue
                }
              }
            }
          }
        } catch (e) {
          console.log(`[Puppeteer] Cannot access iframe content (CORS protected)`);
        }
      }
    } catch (error) {
      console.log(`[Puppeteer] Could not interact with iframe: ${error.message}`);
    }
    
    // Approach 2: Try to trigger the backup video if available
    try {
      await page.evaluate(() => {
        const video = document.getElementById('backup-video');
        if (video && video.style.display !== 'none') {
          video.play();
          console.log('Backup video started');
        }
      });
    } catch (e) {
      // Backup video not available
    }
    
    // Approach 3: Simulate user interaction to enable autoplay
    try {
      await page.evaluate(() => {
        // Simulate click anywhere on page to enable autoplay
        document.body.click();
        
        // Try to find and click any play buttons
        const playButtons = document.querySelectorAll('button, [role="button"]');
        playButtons.forEach(btn => {
          const text = btn.textContent?.toLowerCase() || '';
          const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
          if (text.includes('play') || ariaLabel.includes('play')) {
            btn.click();
          }
        });
      });
    } catch (e) {
      // Continue
    }
    
    // Wait longer for stream to start playing
    console.log(`[Puppeteer] Waiting for stream to start playing...`);
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Record actual video for 90 seconds using puppeteer-screen-recorder
    const duration = 90000; // 90 seconds in milliseconds
    const os = require('os');
    const tempVideoPath = `${os.tmpdir()}/shoutout_${cardData.streamerName}_${timestamp}.mp4`;
    
    console.log(`[Puppeteer] Starting 90-second video recording for ${cardData.streamerName}`);
    
    try {
      // Try puppeteer-screen-recorder first
      const { PuppeteerScreenRecorder } = await import('puppeteer-screen-recorder');
      
      const recorder = new PuppeteerScreenRecorder(page, {
        fps: 15, // Lower FPS for smaller files
        ffmpeg_Path: 'ffmpeg',
        videoFrame: {
          width: 960,
          height: 540,
        },
        videoCrf: 23, // Higher CRF for smaller files
        videoCodec: 'libx264',
        videoPreset: 'fast',
        videoBitrate: 500, // Lower bitrate
      });
      
      await recorder.start(tempVideoPath);
      await new Promise(resolve => setTimeout(resolve, duration));
      await recorder.stop();
      
      // Convert to GIF and upload
      const gifUrl = await convertClipToGif(
        tempVideoPath,
        `shoutout_${cardData.streamerName}_${timestamp}`,
        cardData.streamerName,
        90,
        'stream',
        { serverId }
      );
      
      const fs = require('fs');
      const videoBuffer = fs.readFileSync(tempVideoPath);
      const base64Video = `data:video/mp4;base64,${videoBuffer.toString('base64')}`;
      const mp4FileName = `recordings/shoutout_${cardData.streamerName}_${timestamp}.mp4`;
      const mp4Url = await uploadGifFromUrl(base64Video, mp4FileName);
      
      try { fs.unlinkSync(tempVideoPath); } catch (e) {}
      
      // Save to rotation system
      await updateGifRotation(serverId, cardData.streamerName, gifUrl, mp4Url);
      
      return { gifUrl, mp4Url };
      
    } catch (recorderError) {
      console.log(`[Puppeteer] Screen recorder failed, using static screenshot fallback:`, recorderError.message);
      
      // Fallback to single static screenshot
      const screenshot = await page.screenshot({ 
        type: 'png',
        clip: { x: 0, y: 0, width: 960, height: 540 }
      });
      const base64Image = `data:image/png;base64,${screenshot.toString('base64')}`;
      const staticFileName = `static/shoutout_${cardData.streamerName}_${timestamp}.png`;
      const staticUrl = await uploadGifFromUrl(base64Image, staticFileName);
      
      if (staticUrl) {
        // Save static image to rotation system
        await updateGifRotation(serverId, cardData.streamerName, staticUrl, staticUrl);
        
        return { gifUrl: staticUrl, mp4Url: staticUrl };
      }
      
      console.log(`[Puppeteer] Static screenshot fallback failed, trying frame method:`);
      
      // Fallback: Multiple screenshots for animated GIF
      const frames = [];
      const frameCount = 45; // 45 frames over 90 seconds = 2 second intervals
      const frameInterval = duration / frameCount;
      
      for (let i = 0; i < frameCount; i++) {
        try {
          const screenshot = await page.screenshot({ 
            type: 'png',
            clip: { x: 0, y: 0, width: 960, height: 540 }
          });
          frames.push(screenshot);
          
          if (i < frameCount - 1) {
            await new Promise(resolve => setTimeout(resolve, frameInterval));
          }
        } catch (e) {
          break;
        }
      }
      
      if (frames.length > 1) {
        // Create GIF from frames using FFmpeg
        const fs = require('fs');
        const path = require('path');
        const tempDir = path.join(os.tmpdir(), `frames_${timestamp}`);
        
        try {
          fs.mkdirSync(tempDir, { recursive: true });
          
          // Save frames
          for (let i = 0; i < frames.length; i++) {
            fs.writeFileSync(path.join(tempDir, `frame_${i.toString().padStart(3, '0')}.png`), frames[i]);
          }
          
          // Create GIF with FFmpeg
          const { exec } = require('child_process');
          const gifPath = path.join(tempDir, 'output.gif');
          const cmd = `ffmpeg -y -framerate 2 -i "${tempDir}/frame_%03d.png" -vf "scale=960:540:flags=lanczos,palettegen" "${tempDir}/palette.png" && ffmpeg -y -framerate 2 -i "${tempDir}/frame_%03d.png" -i "${tempDir}/palette.png" -filter_complex "scale=960:540:flags=lanczos[x];[x][1:v]paletteuse" "${gifPath}"`;
          
          await new Promise((resolve) => {
            exec(cmd, () => resolve(null)); // Ignore errors, continue
          });
          
          let gifUrl = null;
          if (fs.existsSync(gifPath)) {
            const gifBuffer = fs.readFileSync(gifPath);
            const base64Gif = `data:image/gif;base64,${gifBuffer.toString('base64')}`;
            const gifFileName = `gifs/shoutout_${cardData.streamerName}_${timestamp}.gif`;
            gifUrl = await uploadGifFromUrl(base64Gif, gifFileName);
          }
          
          fs.rmSync(tempDir, { recursive: true, force: true });
          
          const mp4FileName = `recordings/shoutout_${cardData.streamerName}_${timestamp}.mp4`;
          const mp4Url = `https://firebasestorage.googleapis.com/v0/b/studio-9468926194-e03ac.firebasestorage.app/o/${encodeURIComponent(mp4FileName)}?alt=media`;
          
          // Save frame-based GIF to rotation system
          if (gifUrl) {
            await updateGifRotation(serverId, cardData.streamerName, gifUrl, mp4Url);
          }
          
          return { gifUrl, mp4Url };
          
        } catch (frameError) {
          console.log('Frame processing failed:', frameError.message);
        }
      }
    }
      
    // Final fallback if all methods fail
    console.log(`[Puppeteer] All recording methods failed, using single screenshot`);
    
    // Fallback: take screenshot and create static GIF
    const screenshot = await page.screenshot({ 
      type: 'png',
      clip: { x: 0, y: 0, width: 960, height: 540 }
    });
    const base64Image = `data:image/png;base64,${screenshot.toString('base64')}`;
    
    const gifFileName = `static/shoutout_${cardData.streamerName}_${timestamp}.png`;
    const firebaseUrl = await uploadGifFromUrl(base64Image, gifFileName);
    
    // Save final fallback to rotation system
    if (firebaseUrl) {
      await updateGifRotation(serverId, cardData.streamerName, firebaseUrl, firebaseUrl);
    }
    
    return {
      gifUrl: firebaseUrl,
      mp4Url: firebaseUrl
    };

  } catch (error) {
    console.error(`[generateShoutoutCardGif] Error:`, error);
    return null;
  } finally {
    if (browser) {
      console.log(`[Puppeteer] Closing shoutout card browser`);
      await browser.close();
    }
  }
}

/**
 * GIF Specifications:
 * - Duration: 60 seconds
 * - Dimensions: 800x600 pixels
 * - Frame Rate: 30 fps (high quality source)
 * - File Size: ~150-300MB MP4 -> ~30-60MB GIF (estimated)
 * - Format: MP4 -> GIF conversion via FreeConvert API
 * - Capture Method: puppeteer-screen-recorder records MP4 of card with live Twitch iframe
 * - Update Frequency: Every 5 minutes per streamer
 * 
 * Recording Settings:
 * - Video Codec: libx264
 * - CRF: 18 (good quality)
 * - Bitrate: 1000 kbps
 * - Preset: ultrafast (for real-time recording)
 * 
 * Conversion: FreeConvert API converts 30fps MP4 to 15fps optimized GIF
 */

async function updateGifRotation(serverId: string, streamerName: string, gifUrl: string, mp4Url: string): Promise<void> {
  try {
    const { db } = await import('@/firebase/server-init');
    const rotationRef = db.collection('servers').doc(serverId).collection('gifRotation').doc(`stream_${streamerName.toLowerCase()}`);
    const rotationDoc = await rotationRef.get();
    
    const now = new Date();
    
    if (!rotationDoc.exists) {
      // Start new session
      await rotationRef.set({
        sessionStart: now,
        lastGenerated: now,
        gifCount: 1,
        gifs: [{ gifUrl, mp4Url, createdAt: now }],
        streamerName
      });
      console.log(`[GifRotation] Started new session for ${streamerName} (1/6)`);
      return;
    }
    
    const data = rotationDoc.data();
    const sessionStart = data?.sessionStart?.toDate();
    const gifCount = data?.gifCount || 0;
    const gifs = data?.gifs || [];
    
    // Check if session is older than 24 hours
    if (sessionStart && (now.getTime() - sessionStart.getTime()) > (24 * 60 * 60 * 1000)) {
      // Start fresh session
      await rotationRef.set({
        sessionStart: now,
        lastGenerated: now,
        gifCount: 1,
        gifs: [{ gifUrl, mp4Url, createdAt: now }],
        streamerName
      });
      console.log(`[GifRotation] Started fresh session for ${streamerName} (1/6)`);
      return;
    }
    
    if (gifCount < 6) {
      // Add new GIF to collection
      const newGifs = [...gifs, { gifUrl, mp4Url, createdAt: now }];
      await rotationRef.update({
        lastGenerated: now,
        gifCount: gifCount + 1,
        gifs: newGifs
      });
      console.log(`[GifRotation] Added GIF ${gifCount + 1}/6 for ${streamerName}`);
    }
  } catch (error) {
    console.error('Error updating GIF rotation:', error);
  }
}

export async function createActualGif(frames: Buffer[], width: number, height: number): Promise<Buffer> {
  // TODO: Implement with gif-encoder-2 or similar
  // const encoder = new GIFEncoder(width, height);
  // encoder.start();
  // encoder.setRepeat(0); // Loop forever
  // encoder.setDelay(2000); // 2 second delay between frames
  // encoder.setQuality(10); // Lower quality for smaller file size
  // 
  // for (const frame of frames) {
  //   encoder.addFrame(frame);
  // }
  // 
  // encoder.finish();
  // return encoder.out.getData();
  
  // For now, return first frame
  return frames[0];
}

export async function generateContinuousStreamGif(
  streamUrl: string,
  streamerName: string,
  duration: number = 600 // 10 minutes
): Promise<string | null> {
  console.log(`Starting continuous capture for ${streamerName} (${duration}s)`);
  return null;
}
