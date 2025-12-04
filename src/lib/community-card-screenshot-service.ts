'use server';

export async function takeCommunityCardScreenshot(
  serverId: string,
  streamerName: string,
  streamData: any
): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const localServiceUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');

    if (!localServiceUrl) {
      console.log('[CommunityCardScreenshot] No local service configured');
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

    const { getBaseUrl } = await import('./base-url');
    const appUrl = await getBaseUrl(serverId);
    const cardUrl = `${appUrl}/headless/community-card/${serverId}?${params.toString()}`;

    console.log(`[CommunityCardScreenshot] Taking screenshot for ${streamerName}`);

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
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.log(`[CommunityCardScreenshot] Local service failed: ${response.status}`);
      return null;
    }

    const { dataUrl, imageUrl } = await response.json();
    console.log(`[CommunityCardScreenshot] Screenshot successful for ${streamerName}`);
    return imageUrl || dataUrl || null;

  } catch (error) {
    console.log(`[CommunityCardScreenshot] Error for ${streamerName}:`, error);
    return null;
  }
}