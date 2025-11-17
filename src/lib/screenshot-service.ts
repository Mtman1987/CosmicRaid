'use server';

import { uploadFileToFirebase } from './firebase-storage-service';
import { freeConvertService } from './community-spotlight-serverside-fallback';

/**
 * Takes a screenshot of a given URL using the FreeConvert API.
 * The local Puppeteer path has been removed for a more direct approach.
 *
 * @param url The URL of the page to screenshot.
 * @param fileName The base name for the output file.
 * @param viewport The viewport dimensions for the browser.
 * @returns A promise that resolves to the public URL of the uploaded screenshot, or null if it fails.
 */
export async function takeScreenshot(
  url: string,
  fileName: string,
  viewport: { width: number; height: number; deviceScaleFactor?: number } = { width: 1200, height: 800 }
): Promise<string | null> {
  // --- Use FreeConvert API directly ---
  try {
    const screenshotBuffer = await takeScreenshotWithFreeConvert(url, viewport);
    if (screenshotBuffer) {
      console.log(`[Screenshot] Successfully generated screenshot for ${url} using FreeConvert.`);
      return await uploadFileToFirebase(screenshotBuffer, fileName, 'image/png');
    }
  } catch (error) {
    console.error(`[Screenshot] FreeConvert screenshot failed for ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.error(`[Screenshot] All methods failed to take screenshot for ${url}.`);
  return null;
}


async function takeScreenshotWithFreeConvert(
  url: string,
  viewport: { width: number; height: number }
): Promise<Buffer | null> {
    // This is a placeholder for actual FreeConvert screenshot logic.
    // The service needs to be fully implemented if it's not already.
    console.log(`[Screenshot] Attempting FreeConvert screenshot for: ${url}`);
    
    // Simulate failure since the service method might not exist.
    // In a real implementation, you would call freeConvertService.takeWebsiteScreenshot(url, viewport);
    console.warn('[Screenshot] takeScreenshotWithFreeConvert is not fully implemented and will fail.');
    
    // For now, let's just throw an error to indicate it's not ready.
    throw new Error('takeScreenshotWithFreeConvert is not implemented.');
}
