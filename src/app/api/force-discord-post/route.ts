import { NextRequest, NextResponse } from 'next/server';
import { postAllShoutoutsToDiscord } from '@/lib/automated-shoutout-system';

/**
 * Manual trigger to force Discord posting of shoutouts
 */
export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();
    
    if (!serverId) {
      return NextResponse.json({
        success: false,
        error: 'Server ID is required'
      }, { status: 400 });
    }

    console.log('[ForceDiscordPost] Manual Discord posting triggered for server:', serverId);
    
    await postAllShoutoutsToDiscord(serverId);
    
    return NextResponse.json({
      success: true,
      message: 'Discord posting completed successfully',
      serverId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[ForceDiscordPost] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to post to Discord',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}