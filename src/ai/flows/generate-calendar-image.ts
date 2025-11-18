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
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const screenshotUrl = `${appUrl}/headless/calendar/${guildId?.replace(/[\r\n]/g, '')}?offset=${monthOffset}`;

  let browser;
  try {
    console.log('[Puppeteer] Launching browser for calendar screenshot of:', screenshotUrl?.replace(/[\r\n]/g, ''));
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

    console.log('[Puppeteer] Navigating to:', screenshotUrl?.replace(/[\r\n]/g, ''));
    page.setDefaultTimeout(30000);
    await page.goto(screenshotUrl, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait for React to hydrate and render
    await page.waitForSelector('main', { timeout: 15000 });
    
    // Wait for avatars and content to load
    try {
      await page.waitForSelector('img', { timeout: 10000 });
      // Wait for network to be idle (Puppeteer equivalent)
      await page.waitForLoadState ? page.waitForLoadState('networkidle') : 
        new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      console.log('[Puppeteer] No images found or timeout, proceeding...');
    }
    
    // Extra delay for avatar loading
    await new Promise(resolve => setTimeout(resolve, 2000));

    const imageBuffer = await page.screenshot({ type: 'png' });
    
    console.log('[Puppeteer] Calendar screenshot taken successfully.');
    return `data:image/png;base64,${imageBuffer.toString('base64')}`;

  } catch (error) {
    console.error('[generateCalendarImage] Error:', error?.message?.replace(/[\r\n]/g, '') || 'Unknown error');
    return null;
  } finally {
    if (browser) {
      console.log('[Puppeteer] Closing calendar browser.');
      await browser.close();
    }
  }
}
