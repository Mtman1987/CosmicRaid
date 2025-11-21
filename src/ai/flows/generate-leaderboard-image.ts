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
  const { getBaseUrl } = await import('@/lib/base-url');
  const appUrl = await getBaseUrl(guildId);
  const screenshotUrl = `${appUrl}/headless/leaderboard/${guildId}`;
  // Try local service first if available
  const { getServerConfig } = await import('@/lib/config-service');
  const localServiceUrl =
    (await getServerConfig(guildId, 'LOCAL_CONVERSION_SERVICE_URL')) ||
    process.env.LOCAL_CONVERSION_SERVICE_URL;
  if (localServiceUrl) {
    try {
      console.log('[LocalService] Taking leaderboard screenshot via local service...');
      const response = await fetch(`${localServiceUrl}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: screenshotUrl, selector: 'div.w-\\[600px\\]' })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('[LocalService] Leaderboard screenshot taken successfully.');
        
        // Handle both Firebase Storage URL and base64 fallback
        if (result.imageUrl) {
          return result.imageUrl;
        } else if (result.dataUrl) {
          return result.dataUrl;
        }
      }
      console.log('[LocalService] Screenshot failed, falling back to FreeConvert');
    } catch (error) {
      console.log('[LocalService] Not available, falling back to FreeConvert');
    }
  }

  // Fallback to FreeConvert API
  const apiKey =
    (await getServerConfig(guildId, 'FREE_CONVERT_API_KEY')) ||
    process.env.FREE_CONVERT_API_KEY;
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

    let jobData;
    try {
      jobData = await response.json();
      console.log('[FreeConvert] Response:', response.status, JSON.stringify(jobData, null, 2));
    } catch (parseError) {
      console.error('[FreeConvert] Failed to parse response:', response.status, await response.text());
      throw new Error(`Job creation failed: ${response.status} - Invalid response`);
    }
    
    if (!jobData?.id) {
      throw new Error(`No job ID received from FreeConvert: ${response.status}`);
    }
    
    // Poll for completion
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      const statusData = await statusResponse.json();
      console.log(`[FreeConvert] Job status: ${statusData.status} (attempt ${i + 1}/30)`);
      
      // Log all task statuses
      const importTask = statusData.tasks['import-1'];
      const convertTask = statusData.tasks['convert-1'];
      const exportTask = statusData.tasks['export-1'];
      
      console.log(`[FreeConvert] import-1 status: ${importTask?.status}`);
      console.log(`[FreeConvert] convert-1 status: ${convertTask?.status}`);
      console.log(`[FreeConvert] export-1 status: ${exportTask?.status}`);
      
      if (exportTask?.status === 'completed' && exportTask?.result?.files?.[0]?.url) {
        console.log('[FreeConvert] Leaderboard screenshot completed:', exportTask.result.files[0].url);
        return exportTask.result.files[0].url;
      }

      if (statusData.status === 'failed' || exportTask?.status === 'failed') {
        console.error('[FreeConvert] Job or export task failed:', JSON.stringify(statusData, null, 2));
        throw new Error('FreeConvert job failed');
      }
    }
    
    // Fallback: construct predictable URL even if polling failed
    const fallbackUrl = `https://s120-grog.freeconvert.com/task/${jobData.tasks['export-1'].id}/cosmicraid--studio-9468926194-e03ac_us-central1_hosted_app__headless_leaderboard_${guildId}.png`;
    console.log('[FreeConvert] Polling timeout, trying fallback URL:', fallbackUrl);
    return fallbackUrl;
  } catch (error) {
    console.error('[generateLeaderboardImage] Both local service and FreeConvert failed:', error);
    return null;
  }
}
