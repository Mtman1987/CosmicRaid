import { NextRequest, NextResponse } from 'next/server';
// import { generateAndPostLeaderboard } from '@/lib/leaderboard-discord-service';

export async function POST(request: NextRequest) {
  try {
    const { serverId } = await request.json();
    
    if (!serverId) {
      return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
    }
    
    // await generateAndPostLeaderboard(serverId);
    
    return NextResponse.json({ success: true, message: 'Leaderboard route disabled in local services' });
  } catch (error) {
    console.error('Error generating leaderboard:', error);
    return NextResponse.json({ error: 'Failed to generate leaderboard' }, { status: 500 });
  }
}