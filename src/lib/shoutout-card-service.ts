'use server';

import { getSecret } from './config-service';

export async function generateShoutoutCard(
  serverId: string,
  cardData: any
): Promise<string | null> {
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
  
  try {
    console.log(`[ShoutoutCard] Generating card for ${cardData.streamerName}`);
    
    const appUrl = localServiceUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const cardUrl = `${appUrl}/headless/shoutout-card/${serverId}?streamer=${cardData.streamerName}`;

    if (localServiceUrl) {
      const response = await fetch(`${localServiceUrl}/api/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: cardUrl,
          width: 960,
          height: 540,
          waitFor: 3000
        })
      });
      
      if (response.ok) {
        const { dataUrl } = await response.json();
        console.log(`[ShoutoutCard] Generated card successfully`);
        return dataUrl;
      }
    }
    
    console.log(`[ShoutoutCard] Local service unavailable`);
    return null;

  } catch (error) {
    console.error(`[ShoutoutCard] Error:`, error);
    return null;
  }
}