'use server';

export async function generateShoutoutCard(
  serverId: string,
  cardData: any
): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) {
      console.log('[ShoutoutCard] No tunnel URL configured');
      return null;
    }

    const response = await fetch(`${tunnelUrl}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/headless/shoutout-card/${serverId}?streamer=${cardData.streamerName}`,
        width: 960,
        height: 540,
        waitFor: 3000
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
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const response = await fetch(`${tunnelUrl}/api/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/headless/shoutout-card/${serverId}?streamer=${cardData.streamerName}`,
        width: 960,
        height: 540,
        duration: 5000,
        format: 'gif'
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (response.ok) {
      const { gifUrl } = await response.json();
      return gifUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}