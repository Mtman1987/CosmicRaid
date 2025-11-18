'use server';

export async function recordFooterVideo(serverId: string): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const response = await fetch(`${tunnelUrl}/api/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/headless/footer/${serverId}`,
        width: 1920,
        height: 200,
        duration: 60000,
        format: 'mp4'
      }),
      signal: AbortSignal.timeout(70000)
    });
    
    if (response.ok) {
      const { videoUrl } = await response.json();
      return videoUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function generateFooterGif(serverId: string): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const response = await fetch(`${tunnelUrl}/api/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/headless/footer/${serverId}`,
        width: 1920,
        height: 200,
        duration: 10000,
        format: 'gif'
      }),
      signal: AbortSignal.timeout(20000)
    });
    
    if (response.ok) {
      const { gifUrl } = await response.json();
      return gifUrl;
    }
    return null;
  } catch (error) {
    return null;
  }
}