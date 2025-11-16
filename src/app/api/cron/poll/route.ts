import { NextRequest, NextResponse } from 'next/server';
import { executeScheduledPoll } from '@/lib/cloud-scheduler';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET || 'default-secret'}`;
    
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const serverId = body.serverId || process.env.HARDCODED_GUILD_ID;
    
    if (!serverId) {
      return NextResponse.json({ error: 'No server ID available' }, { status: 400 });
    }

    await executeScheduledPoll(serverId);

    return NextResponse.json({ 
      success: true, 
      message: 'Poll executed successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cron poll error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Cosmic Raid Cron Polling Endpoint',
    usage: 'POST with Authorization header to trigger polling'
  });
}