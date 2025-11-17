import { NextRequest, NextResponse } from 'next/server';
import { runAutomatedShoutoutCycle } from '@/lib/automated-shoutout-system';

/**
 * Cron endpoint for Cloud Scheduler to trigger shoutout cycles
 * Can also be called manually or by external services
 * 
 * Cloud Scheduler setup:
 * - Frequency: */10 * * * * (every 10 minutes)
 * - URL: https://your-app.us-central1.hosted.app/api/cron/shoutouts
 * - Method: GET or POST
 */
export async function GET(request: NextRequest) {
  return handleShoutoutCron(request);
}

export async function POST(request: NextRequest) {
  return handleShoutoutCron(request);
}

async function handleShoutoutCron(request: NextRequest) {
  try {
    // Verify this is from Cloud Scheduler or a valid source
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-cloudscheduler');
    
    // Allow requests from Cloud Scheduler or with valid auth
    // In production, you'd validate the auth token properly
    const isCloudScheduler = cronHeader === 'true';
    const hasAuth = authHeader?.startsWith('Bearer ');
    
    // For now, allow all requests (you can secure this later)
    console.log('[Cron] Shoutout cycle triggered', {
      isCloudScheduler,
      hasAuth,
      source: request.headers.get('user-agent')
    });
    
    // Hardcoded server ID (you could also read from Firestore config)
    const serverId = '1240832965865635881';
    
    console.log(`[Cron] Running shoutout cycle for server ${serverId}`);
    
    // Run the cycle (respects 10-minute cooldown internally)
    await runAutomatedShoutoutCycle(serverId, { force: false });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Shoutout cycle completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Cron] Shoutout cycle error:', error);
    return NextResponse.json({ 
      error: 'Failed to run shoutout cycle',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
