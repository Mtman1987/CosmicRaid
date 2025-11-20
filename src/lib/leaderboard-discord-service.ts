'use server';

export async function generateLeaderboardForDiscord(serverId: string): Promise<string | null> {
  try {
    console.log(`[LeaderboardDiscord] Generating leaderboard for ${serverId}`);
    
    const HOSTED_BASE = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';
    const appUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      HOSTED_BASE;
    const leaderboardUrl = `${appUrl}/headless/leaderboard/${serverId}`;

    const { getServerConfig } = await import('./config-service');
    const localServiceUrl =
      (await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL')) ||
      process.env.LOCAL_CONVERSION_SERVICE_URL;

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
        const { dataUrl, imageUrl } = await response.json();
        console.log(`[LeaderboardDiscord] Generated leaderboard successfully`);
        return imageUrl || dataUrl || null;
      }
    }
    
    console.log(`[LeaderboardDiscord] Local service unavailable`);
    return null;

  } catch (error) {
    console.error(`[LeaderboardDiscord] Error:`, error);
    return null;
  }
}
