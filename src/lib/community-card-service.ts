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

    const appUrl = process.env.NEXT_PUBLIC_BASE_URL;
    const cardUrl = `${appUrl}/headless/community-card/${serverId}?${params.toString()}`;

    // Try Puppeteer first for visual consistency
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
          })
        });
        
        if (response.ok) {
          const { dataUrl } = await response.json();
          const base64Data = dataUrl.split(',')[1];
          const screenshot = Buffer.from(base64Data, 'base64');
          
          // Upload to Firebase Storage
          const timestamp = Date.now();
          const fileName = `community_cards/${streamerName}_${timestamp}.png`;
          const downloadUrl = await uploadFileToFirebase(screenshot, fileName, 'image/png');

          console.log(`[CommunityCard] Generated card: ${downloadUrl}`);
          return downloadUrl;
        }
      } catch (puppeteerError) {
        console.log(`[CommunityCard] Puppeteer failed for ${streamerName}:`, puppeteerError);
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