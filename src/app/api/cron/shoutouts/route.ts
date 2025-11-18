import { NextRequest, NextResponse } from 'next/server';
import { runUnifiedCronCycle } from '@/lib/unified-cron-service';

/**
 * Cron endpoint for Cloud Scheduler to trigger shoutout cycles
 * Can also be called manually or by external services
 * 
 * Cloud Scheduler setup:
 * - Frequency: every 10 minutes
 * - URL: your app URL with /api/cron/shoutouts
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
    
    // Run unified cron cycle for all servers
    const result = await runUnifiedCronCycle();
    
    return NextResponse.json({ 
      success: result.success, 
      message: `Processed ${result.serversProcessed} servers, ${result.totalUsers} users, ${result.apiCalls} API calls`,
      serversProcessed: result.serversProcessed,
      totalUsers: result.totalUsers,
      apiCalls: result.apiCalls,
      errors: result.errors,
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
