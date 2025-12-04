import { NextRequest, NextResponse } from 'next/server';
import { runUnifiedCronCycle } from '@/lib/unified-cron-service';

/**
 * Manual trigger to force update user statuses
 * Use this to test if the Twitch polling is working
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[ForceUpdate] Manual user status update triggered');
    
    const result = await runUnifiedCronCycle();
    
    return NextResponse.json({
      success: result.success,
      message: `Force update completed. Processed ${result.serversProcessed} servers, ${result.totalUsers} users with ${result.apiCalls} API calls`,
      details: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ForceUpdate] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to force update user statuses',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}