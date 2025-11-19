import { NextRequest, NextResponse } from 'next/server';

function generateSimpleShoutout(username: string): string {
  return `🚀 Captain ${username} is ready for action! Check out their stream at twitch.tv/${username} and join the Space Mountain adventure!`;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.BOT_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username, type } = await request.json();
    
    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const shoutout = generateSimpleShoutout(username);
    
    return NextResponse.json({
      shoutout,
      username: username
    });

  } catch (error) {
    console.error('Error generating shoutout:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}