'use server';

export async function takeLeaderboardScreenshot(serverId: string): Promise<string | null> {
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
  
  try {
    console.log(`[LeaderboardScreenshot] Taking screenshot for ${serverId}`);
    
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const leaderboardUrl = `${appUrl}/headless/leaderboard/${serverId}`;

    if (localServiceUrl) {
      const response = await fetch(`${localServiceUrl}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: leaderboardUrl,
          width: 600,
          height: 800,
          waitFor: 2000
        })
      });
      
      if (response.ok) {
        const { dataUrl } = await response.json();
        console.log(`[LeaderboardScreenshot] Screenshot taken successfully`);
        return dataUrl;
      }
    }
    
    console.log(`[LeaderboardScreenshot] Local service unavailable`);
    return null;

  } catch (error) {
    console.error(`[LeaderboardScreenshot] Error:`, error);
    return null;
  }
}