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
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const screenshotUrl = `${appUrl}/headless/leaderboard/${guildId}`;

  let browser;
  let page;
  try {
    console.log('[Puppeteer] Launching browser for leaderboard...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
    page = await browser.newPage();
    // The width is fixed in the component, height is dynamic based on content.
    await page.setViewport({ width: 800, height: 800, deviceScaleFactor: 1.5 });

    console.log(`[Puppeteer] Navigating to ${screenshotUrl}`);
    await page.goto(screenshotUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for a specific element to ensure content is loaded
    await page.waitForSelector('.leaderboard-entry', { timeout: 10000 });
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Get the bounding box of the main container
    const element = await page.$('.leaderboard');
    if (!element) {
      throw new Error(
        'Could not find leaderboard container element for screenshot.'
      );
    }
    const boundingBox = await element.boundingBox();

    if (!boundingBox) {
      throw new Error('Could not get bounding box of leaderboard element.');
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
    console.error(`[generateLeaderboardImage] Puppeteer error, using fallback image:`, error);
     try {
      const response = await fetch('https://picsum.photos/seed/leaderboard/600/800');
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (fallbackError) {
       console.error(`[generateLeaderboardImage] Fallback image failed:`, fallbackError);
       return null;
    }
  } finally {
    if (browser) {
      console.log('[Puppeteer] Closing leaderboard browser.');
      await browser.close();
    }
  }
}
