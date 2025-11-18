'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a leaderboard image.
 * This is a simple wrapper around a local service call for screenshotting a headless page.
 *
 * - generateLeaderboardImage - A function that returns a base64 encoded PNG of the leaderboard.
 */

export async function generateLeaderboardImage(
  guildId: string
): Promise<string | null> {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const screenshotUrl = `${appUrl}/headless/leaderboard/${guildId}`;
  // Try local service first if available
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
  if (localServiceUrl) {
    try {
      console.log('[LocalService] Taking leaderboard screenshot via local service...');
      const response = await fetch(`${localServiceUrl}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: screenshotUrl, selector: 'div.w-\\[600px\\]' })
      });
      
      if (response.ok) {
        const { dataUrl } = await response.json();
        console.log('[LocalService] Leaderboard screenshot taken successfully.');
        return dataUrl;
      }
    } catch (error) {
      console.error('[LocalService] Failed, falling back to FreeConvert:', error);
    }
  }

  // Fallback to FreeConvert API
  const apiKey = process.env.FREE_CONVERT_API_KEY;
  if (!apiKey) {
    console.error('[FreeConvert] API key not found');
    return null;
  }

  try {
    console.log('[FreeConvert] Taking leaderboard screenshot...');
    const response = await fetch('https://api.freeconvert.com/v1/process/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "tasks": {
          "import-1": {
            "operation": "import/webpage",
            "url": screenshotUrl
          },
          "convert-1": {
            "operation": "convert",
            "input": "import-1",
            "input_format": "webpage",
            "output_format": "png",
            "options": {
              "viewport_width": 600,
              "viewport_height": 800,
              "delay": 3000
            }
          },
          "export-1": {
            "operation": "export/url",
            "input": ["convert-1"]
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Job creation failed: ${response.status}`);
    }

    const jobData = await response.json();
    
    // Poll for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'completed') {
        const exportTask = statusData.tasks['export-1'];
        if (exportTask?.result?.files?.[0]?.url) {
          const imageResponse = await fetch(exportTask.result.files[0].url);
          const imageBuffer = await imageResponse.arrayBuffer();
          console.log('[FreeConvert] Leaderboard screenshot completed.');
          return `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`;
        }
      }
      
      if (statusData.status === 'failed') {
        throw new Error('FreeConvert job failed');
      }
    }
    
    throw new Error('FreeConvert job timeout');
  } catch (error) {
    console.error('[generateLeaderboardImage] Error:', error);
    return null;
  }
}