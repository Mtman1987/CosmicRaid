'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a leaderboard image.
 * This is a simple wrapper around a Puppeteer call for screenshotting a headless page.
 *
 * - generateLeaderboardImage - A function that returns a base64 encoded PNG of the leaderboard.
 */

import puppeteer from 'puppeteer';

export async function generateLeaderboardImage(
  guildId: string
): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const screenshotUrl = `${appUrl}/headless/leaderboard/${guildId}`;

  let browser;
  try {
    console.log('[Puppeteer] Launching browser for leaderboard...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    // The width is fixed in the component, height is dynamic based on content.
    await page.setViewport({ width: 600, height: 800, deviceScaleFactor: 1.5 });

    console.log(`[Puppeteer] Navigating to ${screenshotUrl}`);
    await page.goto(screenshotUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    
    // Wait for React to hydrate
    await page.waitForSelector('.leaderboard', { timeout: 15000 });

    // Wait for content and avatars to load
    await page.waitForSelector('h1');
    try {
      await page.waitForSelector('img', { timeout: 10000 });
      // Additional wait for images to load
      await page.evaluate(() => {
        return Promise.all(Array.from(document.images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise(resolve => {
            img.onload = img.onerror = resolve;
          });
        }));
      });
    } catch (e) {
      console.log('[Puppeteer] No avatars found or timeout, proceeding...');
    }
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the bounding box of the main container
    const element = await page.$('div.w-\\[600px\\]');
    if (!element) {
        throw new Error("Could not find leaderboard container element for screenshot.");
    }
    const boundingBox = await element.boundingBox();
    
    if (!boundingBox) {
         throw new Error("Could not get bounding box of leaderboard element.");
    }

    const imageBuffer = await page.screenshot({ 
        type: 'png',
        clip: {
            x: boundingBox.x,
            y: boundingBox.y,
            width: boundingBox.width,
            height: boundingBox.height,
        }
    });

    console.log('[Puppeteer] Leaderboard screenshot taken successfully.');
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;
  } catch (error) {
    console.error(`[generateLeaderboardImage] Error:`, error);
    return null;
  } finally {
    if (browser) {
      console.log('[Puppeteer] Closing leaderboard browser.');
      await browser.close();
    }
  }
}
