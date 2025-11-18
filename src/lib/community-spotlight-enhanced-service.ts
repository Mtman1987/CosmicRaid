'use server';

export async function generateSpotlightVideo(serverId: string, userData: any): Promise<string | null> {
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
  
  try {
    console.log(`[SpotlightEnhanced] Generating video for ${userData.username}`);
    
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const spotlightUrl = `${appUrl}/headless/spotlight/${serverId}?user=${userData.username}`;

    if (localServiceUrl) {
      const response = await fetch(`${localServiceUrl}/api/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: spotlightUrl,
          width: 1920,
          height: 1080,
          duration: 30000,
          format: 'mp4'
        })
      });
      
      if (response.ok) {
        const { videoUrl } = await response.json();
        console.log(`[SpotlightEnhanced] Generated video successfully`);
        return videoUrl;
      }
    }
    
    console.log(`[SpotlightEnhanced] Local service unavailable`);
    return null;

  } catch (error) {
    console.error(`[SpotlightEnhanced] Error:`, error);
    return null;
  }
}