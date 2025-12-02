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
      console.log('[FreeConvert] Job created:', jobData.id);
    } catch (parseError) {
      throw new Error(`Job creation failed: ${response.status}`);
    }
    
    if (!jobData?.id) {
      throw new Error(`No job ID received from FreeConvert: ${response.status}`);
    }
    
    // Wait 10 seconds then get the final result
    console.log('[FreeConvert] Waiting 10 seconds for completion...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Get the completed job with results
    const finalResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const finalData = await finalResponse.json();
    console.log('[FreeConvert] Final job data:', JSON.stringify(finalData, null, 2));
    
    // Find export task and get URL from result
    const exportTask = Object.values(finalData.tasks || {}).find((task: any) => task.name === 'export-1');
    if (exportTask?.result?.url) {
      console.log('[FreeConvert] Found URL in result:', exportTask.result.url);
      return exportTask.result.url;
    }
    
    throw new Error('No URL found in export task result');
  } catch (error) {
    console.error('[generateLeaderboardImage] Both local service and FreeConvert failed:', error);
    return null;
  }
}
