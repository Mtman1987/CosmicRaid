'use server';

export async function recordFooterVideo(serverId: string): Promise<string | null> {
  try {
    const { getServerConfig } = await import('./config-service');
    const tunnelUrl = await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL');
    
    if (!tunnelUrl) return null;

    const HOSTED_BASE = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      HOSTED_BASE;

    const response = await fetch(`${tunnelUrl}/api/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${baseUrl}/headless/footer/${serverId}`,
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

    const HOSTED_BASE = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      HOSTED_BASE;

    const response = await fetch(`${tunnelUrl}/api/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: `${baseUrl}/headless/footer/${serverId}`,
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
