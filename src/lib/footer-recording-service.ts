'use server';

export async function recordFooterVideo(serverId: string): Promise<string | null> {
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
  
  try {
    console.log(`[FooterRecording] Recording video for ${serverId}`);
    
    const appUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001';
    const footerUrl = `${appUrl}/headless/footer/${serverId}`;

    if (localServiceUrl) {
      const response = await fetch(`${localServiceUrl}/api/record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: footerUrl,
          width: 1920,
          height: 200,
          duration: 60000,
          format: 'mp4'
        })
      });
      
      if (response.ok) {
        const { videoUrl } = await response.json();
        console.log(`[FooterRecording] Recorded video successfully`);
        return videoUrl;
      }
    }
    
    console.log(`[FooterRecording] Local service unavailable`);
    return null;

  } catch (error) {
    console.error(`[FooterRecording] Error:`, error);
    return null;
  }
}