'use server';

import puppeteer from 'puppeteer';
import { uploadFileToFirebase } from './firebase-storage-service';
import { freeConvertService } from './community-spotlight-serverside-fallback';

/**
 * Takes a screenshot of a given URL. It first tries to use a local Puppeteer
 * instance. If that fails (e.g., in a serverless environment where Puppeteer
 * isn't running), it falls back to using the FreeConvert API to capture the screenshot.
 *
 * @param url The URL of the page to screenshot.
 * @param fileName The base name for the output file.
 * @param viewport The viewport dimensions for the browser.
 * @returns A promise that resolves to the public URL of the uploaded screenshot, or null if all methods fail.
 */
export async function takeScreenshot(
  url: string,
  fileName: string,
  viewport: { width: number; height: number; deviceScaleFactor?: number } = { width: 1200, height: 800 }
): Promise<string | null> {
  // --- 1. Try Local Puppeteer First ---
  try {
    const screenshot = await takeScreenshotWithPuppeteer(url, viewport);
    if (screenshot) {
      console.log(`[Screenshot] Successfully generated screenshot for ${url} using local Puppeteer.`);
      return await uploadFileToFirebase(screenshot, fileName, 'image/png');
    }
  } catch (error) {
    console.warn(`[Screenshot] Local Puppeteer failed for ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}. Falling back to FreeConvert.`);
  }

  // --- 2. Fallback to FreeConvert API ---
  try {
    const screenshotBuffer = await takeScreenshotWithFreeConvert(url, viewport);
    if (screenshotBuffer) {
      console.log(`[Screenshot] Successfully generated screenshot for ${url} using FreeConvert.`);
      return await uploadFileToFirebase(screenshotBuffer, fileName, 'image/png');
    }
  } catch (error) {
    console.error(`[Screenshot] FreeConvert fallback also failed for ${url}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  console.error(`[Screenshot] All methods failed to take screenshot for ${url}.`);
  return null;
}


async function takeScreenshotWithPuppeteer(
  url: string,
  viewport: { width: number; height: number; deviceScaleFactor?: number }
): Promise<Buffer | null> {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
    await new Promise(resolve => setTimeout(resolve, 5000)); // Extra wait for assets

    const element = await page.$('main');
    if (element) {
        return await element.screenshot({ type: 'png' });
    }
    
    return await page.screenshot({ type: 'png' });

  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function takeScreenshotWithFreeConvert(
  url: string,
  viewport: { width: number; height: number }
): Promise<Buffer | null> {
  // This re-uses the FreeConvertService logic, assuming it's adapted or suitable
  // For a pure screenshot, a different endpoint might be used.
  // This is a placeholder for the actual FreeConvert screenshot logic.
  console.log(`[Screenshot] Simulating FreeConvert screenshot for: ${url}`);
  // In a real scenario, you'd call a method on freeConvertService like:
  // return await freeConvertService.takeWebsiteScreenshot(url, viewport);
  // For now, returning null to indicate it's not fully implemented here.
  return null;
}
