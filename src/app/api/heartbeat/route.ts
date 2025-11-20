import { NextRequest, NextResponse } from 'next/server';
import { getServerConfig } from '@/lib/config-service';
import { getGuildIdFromRequest } from '@/lib/guild-session';

export async function GET(request: NextRequest) {
  let serverId: string | undefined;
  try {
    serverId = await getGuildIdFromRequest(request);
  } catch {
    serverId = undefined;
  }

  const localServiceUrl =
    (serverId ? await getServerConfig(serverId, 'LOCAL_CONVERSION_SERVICE_URL') : undefined) ||
    process.env.LOCAL_CONVERSION_SERVICE_URL;

  try {
    if (!localServiceUrl) {
      return NextResponse.json({ 
        connected: false, 
        error: 'LOCAL_CONVERSION_SERVICE_URL not configured' 
      });
    }

    const response = await fetch(`${localServiceUrl}/heartbeat`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({ 
        connected: true, 
        status: data.status,
        timestamp: data.timestamp,
        message: data.message 
      });
    } else {
      return NextResponse.json({ 
        connected: false, 
        error: `Service responded with ${response.status}` 
      });
    }
  } catch (error) {
    return NextResponse.json({ 
      connected: false, 
      error: error instanceof Error ? error.message : 'Connection failed' 
    });
  }
}
