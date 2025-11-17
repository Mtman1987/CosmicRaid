import { NextRequest, NextResponse } from 'next/server';
import { runAutomatedShoutoutCycle } from '@/lib/automated-shoutout-system';

/**
 * Endpoint to run a single shoutout cycle
 * Called by the local Electron app every 10 minutes
 */
export async function POST(request: NextRequest) {
  try {
    const { serverId, force } = await request.json();
    
    if (!serverId) {
      return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }
    
    console.log(`[API] Running shoutout cycle for server ${serverId}`);
    
    // Run a single cycle (respects the 10-minute cooldown unless force=true)
    await runAutomatedShoutoutCycle(serverId, { force });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Shoutout cycle completed successfully'
    });
    
  } catch (error) {
    console.error('[API] Shoutout cycle error:', error);
    return NextResponse.json({ 
      error: 'Failed to run shoutout cycle',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
