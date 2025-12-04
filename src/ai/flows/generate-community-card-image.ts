'use server';

export async function generateCommunityCardImage(
  serverId: string,
  streamerName: string,
  streamData: any
): Promise<string | null> {
  try {
    console.log(`[CommunityCardImage] Starting generation for ${streamerName}`);

    // Try local screenshot service first
    const { takeCommunityCardScreenshot } = await import('@/lib/community-card-screenshot-service');
    let dataUrl = await takeCommunityCardScreenshot(serverId, streamerName, streamData);
    
    if (dataUrl) {
      console.log(`[CommunityCardImage] Local screenshot successful for ${streamerName}`);
      return dataUrl;
    }

    // Fallback to FreeConvert
    console.log(`[CommunityCardImage] Local service failed, trying FreeConvert for ${streamerName}`);
    
    const apiKey = process.env.FREE_CONVERT_API_KEY;
    if (!apiKey) {
      console.log('[CommunityCardImage] No FreeConvert API key configured');
      return null;
    }

    const params = new URLSearchParams({
      streamer: streamerName,
      title: streamData.title || 'Live Stream',
      game: streamData.game || 'Just Chatting',
      viewers: streamData.viewers?.toString() || '0',
      avatar: streamData.avatarUrl || '',
      thumbnail: streamData.thumbnailUrl || '',
      live: streamData.isLive ? 'true' : 'false'
    });

    const { getBaseUrl } = await import('@/lib/base-url');
    const appUrl = await getBaseUrl(serverId);
    const cardUrl = `${appUrl}/headless/community-card/${serverId}?${params.toString()}`;

    console.log(`[FreeConvert] Target URL: ${cardUrl}`);
    console.log(`[FreeConvert] Taking community card screenshot...`);

    const response = await fetch('https://api.freeconvert.com/v1/process/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tasks: {
          'import-1': {
            operation: 'import/webpage',
            url: cardUrl
          },
          'convert-1': {
            operation: 'convert',
            input: 'import-1',
            input_format: 'webpage',
            output_format: 'png',
            options: {
              viewport_width: 960,
              viewport_height: 360,
              delay: 3000
            }
          },
          'export-1': {
            operation: 'export/url',
            input: ['convert-1']
          }
        }
      })
    });

    if (!response.ok) {
      console.log(`[FreeConvert] Job creation failed: ${response.status}`);
      return null;
    }

    const jobData = await response.json();
    console.log(`[FreeConvert] Job created: ${jobData.id}`);
    console.log(`[FreeConvert] Polling for completion...`);

    // Poll for completion (20 attempts, 3 seconds apart = 60 seconds total)
    for (let attempt = 1; attempt <= 20; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      
      if (!statusResponse.ok) {
        console.log(`[FreeConvert] Status check failed: ${statusResponse.status}`);
        continue;
      }
      
      const statusData = await statusResponse.json();
      console.log(`[FreeConvert] Status: ${statusData.status} (${attempt}/20)`);
      
      if (statusData.status === 'completed') {
        const exportTask = statusData.tasks['export-1'];
        const fileUrl = exportTask?.result?.files?.[0]?.url;
        
        if (fileUrl) {
          console.log(`[FreeConvert] Found URL in result: ${fileUrl}`);
          console.log(`[FreeConvert] Job completed!`);
          return fileUrl;
        }
      }
      
      if (statusData.status === 'failed') {
        console.log(`[FreeConvert] Job failed`);
        break;
      }
    }

    console.log(`[FreeConvert] Job timed out after 60 seconds`);
    return null;

  } catch (error) {
    console.error(`[CommunityCardImage] Error for ${streamerName}:`, error);
    return null;
  }
}