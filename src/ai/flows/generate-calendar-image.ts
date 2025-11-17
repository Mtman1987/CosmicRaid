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
  monthOffset = 0
): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const screenshotUrl = `${appUrl}/headless/calendar/${guildId}?offset=${monthOffset}`;

  let browser;
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
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions'
      ],
    });
    const page = await browser.newPage();
    // The component is designed for a fixed size.
    await page.setViewport({
      width: 620,
      height: 660,
      deviceScaleFactor: 1.5,
    });

    console.log(`[Puppeteer] Navigating to ${screenshotUrl}`);
    page.setDefaultTimeout(60000); // Increase default timeout to 60s
    await page.goto(screenshotUrl, { 
      waitUntil: 'networkidle0',
      timeout: 60000 // Increase navigation timeout
    });
    
    // Wait for the main card element to be definitely loaded.
    await page.waitForSelector('div.w-\\[620px\\]');
    // Add a longer extra delay for slow-loading assets like avatars.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const imageBuffer = await page.screenshot({ type: 'png' });
    
    console.log(`[Puppeteer] Calendar screenshot taken successfully.`);
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;

  } catch (error) {
    console.error(`[generateCalendarImage] Error:`, error);
    return null;
  } finally {
    if (browser) {
      console.log(`[Puppeteer] Closing calendar browser.`);
      await browser.close();
    }
  }
}
