'use server';
/**
 * @fileOverview This file defines a flow for generating a calendar image.
 * Uses the local conversion service via HTTP instead of direct browser automation.
 */

export async function generateCalendarImage(
  guildId: string,
  monthOffset = 0
): Promise<string | null> {
  const { getBaseUrl } = await import('@/lib/base-url');
  const appUrl = await getBaseUrl(guildId);
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
              "page_size": "auto",
              "page_orientation": "landscape",
              "margin": "0px",
              "viewport_width": -2,
              "initial_delay": "1",
              "hide_cookie": true,
              "use_print_stylesheet": false,
              "png_compression_level": "light"
            }
          },
          "export-1": {
            "operation": "export/url",
            "input": ["convert-1"],
            "filename": "calendar-screenshot.png"
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Job creation failed: ${response.status}`);
    }

    const jobData = await response.json();
    
    // Poll for completion (10 iterations = 10 seconds total, since jobs average 3-4 seconds)
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      const statusData = await statusResponse.json();
      console.log(`[FreeConvert] Job status: ${statusData.status} (attempt ${i + 1}/10)`);

      if (statusData.status === 'completed') {
        const exportTask = statusData.tasks['export-1'];
        if (exportTask?.result?.files?.[0]?.url) {
          console.log('[FreeConvert] Calendar screenshot completed.');
          return exportTask.result.files[0].url;
        }
      }

      if (statusData.status === 'failed') {
        console.error('[FreeConvert] Job failed:', statusData);
        throw new Error('FreeConvert job failed');
      }
    }

    throw new Error('FreeConvert job timeout');
  } catch (error) {
    console.error('[generateCalendarImage] Error:', error);
    return null;
  }
}
