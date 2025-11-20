'use server';

export async function takeLeaderboardScreenshot(serverId: string): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const { getBaseUrl } = await import('./base-url');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const baseUrl = await getBaseUrl(serverId);
    const targetUrl = `${baseUrl}/headless/leaderboard/${serverId}`;

    const response = await fetch(`${tunnelUrl}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: targetUrl,
        width: 600,
        height: 800,
        waitFor: 2000
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const result = await response.json();
      // Local service may return imageUrl (bucket) or dataUrl (base64)
      return result.imageUrl || result.dataUrl || null;
    }
    return null;
  } catch (error) {
    return null;
  }
}
