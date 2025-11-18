'use server';
/**
 * @fileOverview This file defines a flow for generating a calendar image.
 * Uses the local conversion service via HTTP instead of direct browser automation.
 */

export async function generateCalendarImage(
  guildId: string,
  monthOffset = 0
): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const screenshotUrl = `${appUrl}/headless/calendar/${guildId?.replace(/[\r\n]/g, '')}?offset=${monthOffset}`;
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;

  if (!localServiceUrl) {
    console.error('[generateCalendarImage] LOCAL_CONVERSION_SERVICE_URL not configured');
    return null;
  }

  try {
    console.log('[LocalService] Taking calendar screenshot via local service:', screenshotUrl?.replace(/[\r\n]/g, ''));
    
    const response = await fetch(`${localServiceUrl}/api/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: screenshotUrl,
        width: 620,
        height: 660,
        deviceScaleFactor: 1.5,
        waitFor: 2000,
        selector: 'main'
      })
    });

    if (!response.ok) {
      throw new Error(`Screenshot service failed: ${response.status}`);
    }

    const result = await response.json();
    console.log('[LocalService] Calendar screenshot completed successfully');
    return result.imageUrl;

  } catch (error) {
    console.error('[generateCalendarImage] Error:', error?.message?.replace(/[\r\n]/g, '') || 'Unknown error');
    return null;
  }
}
