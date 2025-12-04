'use server';

export async function takeLeaderboardScreenshot(serverId: string): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const { getBaseUrl } = await import('./base-url');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) {
      console.log('[LeaderboardScreenshot] No local service URL configured');
      return null;
    }

    const baseUrl = await getBaseUrl(serverId);
    const targetUrl = `${baseUrl}/headless/leaderboard/${serverId}`;
    console.log('[LeaderboardScreenshot] Taking screenshot:', targetUrl);

    const response = await fetch(`${tunnelUrl}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: targetUrl,
        width: 960,
        height: 540,
        waitFor: 4000,
        selector: 'main'
      }),
      signal: AbortSignal.timeout(15000)
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('[LeaderboardScreenshot] Local service success');
      return result.imageUrl || result.dataUrl || null;
    } else {
      console.log('[LeaderboardScreenshot] Local service failed:', response.status);
      return null;
    }
  } catch (error) {
    console.log('[LeaderboardScreenshot] Error:', error);
    return null;
  }
}