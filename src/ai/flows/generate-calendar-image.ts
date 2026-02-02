'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a calendar image.
 * This is a simple wrapper around a Puppeteer call for screenshotting a headless page.
 *
 * - generateCalendarImage - A function that returns a base64 encoded PNG of the calendar.
 */

import puppeteer from 'puppeteer';

export async function generateCalendarImage(
  guildId: string,
  monthOffset: number = 0,
): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
  const screenshotUrl = `${appUrl}/headless/calendar/${guildId}?offset=${monthOffset}`;

  let browser;
  let page;
  try {
    console.log(
      `[Puppeteer] Launching browser for calendar screenshot of ${screenshotUrl}`
    );
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
    // The component is designed for a fixed size.
    await page.setViewport({
      width: 620,
      height: 660,
      deviceScaleFactor: 1.5,
    });

    console.log(`[Puppeteer] Navigating to ${screenshotUrl}`);
    // Increased timeout to give the page more time to load, especially on slower connections.
    await page.goto(screenshotUrl, { waitUntil: 'networkidle0', timeout: 60000 });

    // Wait for a specific element to be definitely loaded.
    await page.waitForSelector('main.w-\\[620px\\]', { timeout: 10000 });
    // Add a longer extra delay just in case of slow-loading assets like avatars.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const imageBuffer = await page.screenshot({ type: 'png' });
    
    console.log(`[Puppeteer] Calendar screenshot taken successfully.`);
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;

  } catch (error) {
    console.error(`[generateCalendarImage] Puppeteer error, using fallback image:`, error);
    try {
      const response = await fetch('https://picsum.photos/seed/calendar/600/600');
      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (fallbackError) {
       console.error(`[generateCalendarImage] Fallback image failed:`, fallbackError);
       return null;
    }
  } finally {
    if (browser) {
      console.log(`[Puppeteer] Closing calendar browser.`);
      await browser.close();
    }
  }
}
