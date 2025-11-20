'use server';

import { uploadFileToFirebase } from './firebase-storage-service';

export async function generateCommunityCard(
  serverId: string,
  streamerName: string,
  streamData: any
): Promise<string | null> {
  const { getServerConfig } = await import('./config-service');
  const localServiceUrl = await getServerConfig(serverId, 'PUPPETEER_SERVICE_URL');
  
  try {
    console.log(`[CommunityCard] Generating card for ${streamerName}`);
    
    // Build URL with stream data
    const params = new URLSearchParams({
      streamer: streamerName,
      title: streamData.title || 'Live Stream',
      game: streamData.game || 'Just Chatting',
      viewers: streamData.viewers?.toString() || '0',
      avatar: streamData.avatarUrl || '',
      thumbnail: streamData.thumbnailUrl || '',
      live: streamData.isLive ? 'true' : 'false'
    });

    const appUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';
    const cardUrl = `${appUrl}/headless/community-card/${serverId}?${params.toString()}`;

    // Try local service first (ngrok tunnel)
    if (localServiceUrl) {
      try {
        const response = await fetch(`${localServiceUrl}/api/screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            url: cardUrl,
            width: 960,
            height: 360,
            waitFor: 2000,
            selector: 'main'
          }),
          signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
          const { dataUrl } = await response.json();
          const base64Data = dataUrl.split(',')[1];
          const screenshot = Buffer.from(base64Data, 'base64');
          
          const timestamp = Date.now();
          const fileName = `community_cards/${streamerName}_${timestamp}.png`;
          const downloadUrl = await uploadFileToFirebase(screenshot, fileName, 'image/png');

          console.log(`[CommunityCard] Local service generated card: ${downloadUrl}`);
          return downloadUrl;
        }
      } catch (puppeteerError) {
        console.log(`[CommunityCard] Local service failed for ${streamerName}:`, puppeteerError);
      }
    }
    
    // Fallback to FreeConvert API
    const apiKey = process.env.FREE_CONVERT_API_KEY;
    if (apiKey) {
      try {
        console.log(`[CommunityCard] Trying FreeConvert for ${streamerName}`);
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

        if (response.ok) {
          const jobData = await response.json();
          
          for (let i = 0; i < 20; i++) {
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
                
                const timestamp = Date.now();
                const fileName = `community_cards/${streamerName}_${timestamp}.png`;
                const downloadUrl = await uploadFileToFirebase(Buffer.from(imageBuffer), fileName, 'image/png');

                console.log(`[CommunityCard] FreeConvert generated card: ${downloadUrl}`);
                return downloadUrl;
              }
            }
            
            if (statusData.status === 'failed') {
              break;
            }
          }
        }
      } catch (freeConvertError) {
        console.log(`[CommunityCard] FreeConvert failed for ${streamerName}:`, freeConvertError);
      }
    }
    
    // Fallback to Twitch thumbnail
    if (streamData.thumbnailUrl) {
      console.log(`[CommunityCard] Using Twitch thumbnail fallback for ${streamerName}`);
      return streamData.thumbnailUrl;
    }
    
    console.log(`[CommunityCard] No fallback available for ${streamerName}`);
    return null;

  } catch (error) {
    console.error(`[CommunityCard] Error generating card for ${streamerName}:`, error);
    return null;
  }
}
