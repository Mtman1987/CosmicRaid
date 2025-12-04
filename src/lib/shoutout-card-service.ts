'use server';

export async function generateShoutoutCard(
  serverId: string,
  cardData: any
): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'PUPPETEER_SERVICE_URL');
    
    if (!tunnelUrl) {
      console.log('[ShoutoutCard] No tunnel URL configured');
      return null;
    }

    const response = await fetch(`${tunnelUrl}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${(process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app')).replace(/\/$/, '')}/headless/shoutout-card/${serverId}?streamer=${cardData.streamerName}`,
        selector: 'div.w-\\[960px\\]',
        waitTime: 4000
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const { dataUrl } = await response.json();
      return dataUrl;
    }
    return null;
  } catch (error) {
    console.error('[ShoutoutCard] Error:', error);
    return null;
  }
}

export async function generateShoutoutCardGif(
  serverId: string,
  cardData: any
): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'PUPPETEER_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
       'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app');
    
    const shoutoutUrl = `${baseUrl.replace(/\/$/, '')}/headless/shoutout-card/${serverId}?` + 
      new URLSearchParams({
        streamer: cardData.streamerName || cardData.username,
        title: cardData.streamTitle || cardData.title || 'Live Stream',
        game: cardData.gameName || cardData.game || 'Just Chatting',
        viewers: (cardData.viewerCount || cardData.viewers || 0).toString(),
        avatar: cardData.avatarUrl || '',
        thumbnail: cardData.streamThumbnail || cardData.thumbnailUrl || '',
        live: (cardData.isLive !== undefined ? cardData.isLive : true).toString(),
        mature: (cardData.isMature || false).toString()
      }).toString();

    const response = await fetch(`${tunnelUrl}/convert-gif`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: shoutoutUrl,
        duration: 5000,
        fps: 10,
        width: 960,
        height: 540
      }),
      signal: AbortSignal.timeout(20000)
    });
    
    if (response.ok) {
      const result = await response.json();
      return result.imageUrl || result.dataUrl;
    }
    return null;
  } catch (error) {
    console.error('[ShoutoutCardGif] Error:', error);
    return null;
  }
}
