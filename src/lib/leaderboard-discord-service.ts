'use server';

export async function generateLeaderboardForDiscord(serverId: string): Promise<string | null> {
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
  
  try {
    console.log(`[LeaderboardDiscord] Generating leaderboard for ${serverId}`);
    
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
          waitFor: 2000,
          selector: '.leaderboard'
        })
      });
      
      if (response.ok) {
        const { dataUrl } = await response.json();
        console.log(`[LeaderboardDiscord] Generated leaderboard successfully`);
        return dataUrl;
      }
    }
    
    console.log(`[LeaderboardDiscord] Local service unavailable`);
    return null;

  } catch (error) {
    console.error(`[LeaderboardDiscord] Error:`, error);
    return null;
  }
}