'use server';

export async function takeLeaderboardScreenshot(serverId: string): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const response = await fetch(`${tunnelUrl}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/headless/leaderboard/${serverId}`,
        width: 600,
        height: 800,
        waitFor: 2000
      }),
      signal: AbortSignal.timeout(10000)
    });
    
    if (response.ok) {
      const { dataUrl } = await response.json();
      return dataUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}