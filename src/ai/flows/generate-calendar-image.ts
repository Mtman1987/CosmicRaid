'use server';
/**
 * @fileOverview This file defines a flow for generating a calendar image.
 * Uses the local conversion service via HTTP instead of direct browser automation.
 */

export async function generateCalendarImage(
  guildId: string,
  monthOffset = 0
): Promise<string | null> {
  const HOSTED_BASE = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';
  const appUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    HOSTED_BASE;
  const screenshotUrl = `${appUrl}/headless/calendar/${guildId?.replace(/[\r\n]/g, '')}?offset=${monthOffset}`;
  const { getServerConfig } = await import('@/lib/config-service');
  const localServiceUrl =
    (await getServerConfig(guildId, 'LOCAL_CONVERSION_SERVICE_URL')) ||
    process.env.LOCAL_CONVERSION_SERVICE_URL;

  // Try local service first if available
  if (localServiceUrl) {
    try {
      console.log('[LocalService] Attempting screenshot:', {
        localServiceUrl: localServiceUrl?.replace(/[\r\n]/g, ''),
        screenshotUrl: screenshotUrl?.replace(/[\r\n]/g, ''),
        guildId: guildId?.replace(/[\r\n]/g, ''),
        monthOffset
      });
      
      const response = await fetch(`${localServiceUrl}/api/screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: screenshotUrl,
          width: 1280,
          height: 660,
          deviceScaleFactor: 1.5,
          waitFor: 2000,
          selector: 'main'
        }),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[LocalService] Screenshot response:', {
          success: result.success,
          hasImageUrl: !!result.imageUrl,
          hasDataUrl: !!result.dataUrl,
          width: result.width,
          height: result.height
        });
        
        // Handle both Firebase Storage URL and base64 fallback
        if (result.imageUrl) {
          console.log('[LocalService] Using Firebase Storage URL');
          return result.imageUrl;
        } else if (result.dataUrl) {
          console.log('[LocalService] Using base64 fallback');
          return result.dataUrl;
        }
      } else {
        console.error('[LocalService] Screenshot failed:', response.status, await response.text());
      }
    } catch (error) {
      console.error('[LocalService] Failed, falling back to FreeConvert:', error);
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
    console.log('[FreeConvert] Taking calendar screenshot...');
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
              "viewport_width": 1280,
              "viewport_height": 660,
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
          console.log('[FreeConvert] Calendar screenshot completed.');
          return `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`;
        }
      }
      
      if (statusData.status === 'failed') {
        throw new Error('FreeConvert job failed');
      }
    }
    
    throw new Error('FreeConvert job timeout');
  } catch (error) {
    console.error('[generateCalendarImage] Error:', error);
    return null;
  }
}
