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
        body: JSON.stringify({ 
          url: screenshotUrl, 
          selector: 'div.w-\\[960px\\]',
          waitTime: 4000
        })
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
              "viewport_width": 960,
              "viewport_height": 540,
              "delay": 4000
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
    
    // Poll for completion (up to 60 seconds like community-card-service)
    console.log('[FreeConvert] Polling for completion...');
    for (let i = 0; i < 20; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      const statusData = await statusResponse.json();

      if (statusData.status === 'completed') {
        console.log('[FreeConvert] Job completed!');
        // Find export task and get URL from result
        // Note: API returns tasks with numeric names "0", "1", "2" not "import-1", "convert-1", "export-1"
        const exportTask = Object.values(statusData.tasks || {}).find((task: any) => task.operation === 'export/url') as any;
        if (exportTask?.result?.url) {
          console.log('[FreeConvert] Found URL in result:', exportTask.result.url);
          return exportTask.result.url;
        }
        throw new Error('No URL found in completed job export task');
      }

      if (statusData.status === 'failed') {
        console.log('[FreeConvert] Job failed:', JSON.stringify(statusData, null, 2));
        throw new Error('FreeConvert job failed');
      }

      console.log(`[FreeConvert] Status: ${statusData.status} (${i + 1}/20)`);
    }

    throw new Error('FreeConvert job timed out after 60 seconds');
  } catch (error) {
    console.error('[generateLeaderboardImage] Both local service and FreeConvert failed:', error);
    return null;
  }
}
