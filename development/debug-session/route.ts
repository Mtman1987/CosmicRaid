import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();
    
    if (!serverId) {
      return NextResponse.json({ error: 'Server ID required' }, { status: 400 });
    }

    // Create a test session
    const { db } = await import('@/firebase/server-init');
    const sessionId = `test-${Date.now()}`;
    
    await db.collection('userSessions').doc(sessionId).set({
      serverId,
      discordUserId: 'test-user',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });

    return NextResponse.json({ 
      sessionId,
      message: 'Test session created',
      serverId 
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST with { "serverId": "your-discord-server-id" } to create test session'
  });
}