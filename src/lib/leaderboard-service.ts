'use server';

export async function generateLeaderboardGif(serverId: string): Promise<string | null> {
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
  
  try {
    console.log(`[LeaderboardService] Generating GIF for ${serverId}`);
    
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const leaderboardUrl = `${appUrl}/headless/leaderboard/${serverId}`;

    if (localServiceUrl) {
      const response = await fetch(`${localServiceUrl}/api/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: leaderboardUrl,
          width: 600,
          height: 800,
          duration: 30000,
          format: 'gif'
        })
      });
      
      if (response.ok) {
        const { gifUrl } = await response.json();
        console.log(`[LeaderboardService] Generated GIF successfully`);
        return gifUrl;
      }
    }
    
    console.log(`[LeaderboardService] Local service unavailable`);
    return null;

  } catch (error) {
    console.error(`[LeaderboardService] Error:`, error);
    return null;
  }
}