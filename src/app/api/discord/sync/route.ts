import { NextRequest, NextResponse } from 'next/server';
import { syncServerData } from '@/lib/discord-sync-service';

export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();
    
    if (!serverId) {
      return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
    }

    await syncServerData(serverId);

    return NextResponse.json({ 
      success: true, 
      message: 'Discord sync completed successfully' 
    });

  } catch (error) {
    console.error('Discord sync API error:', error);
    return NextResponse.json(
      { error: 'Failed to sync Discord data' },
      { status: 500 }
    );
  }
}