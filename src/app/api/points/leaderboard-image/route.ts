import { NextRequest, NextResponse } from 'next/server';
import { takeLeaderboardScreenshot } from '@/lib/leaderboard-screenshot-service';
import { getUserRank, generateLeaderboardGifFromPage } from '@/lib/leaderboard-service';
import { sendDiscordMessage } from '@/lib/discord-bot-service';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.BOT_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serverId = process.env.HARDCODED_GUILD_ID || 'default';
    const dataUrl = await takeLeaderboardScreenshot(serverId);
    
    if (!dataUrl) {
      return NextResponse.json({ error: 'Failed to generate screenshot' }, { status: 500 });
    }

    // Convert data URL to buffer
    const base64Data = dataUrl.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Error generating leaderboard image:', error);
    return NextResponse.json({ error: 'Failed to generate leaderboard image' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, username, channelId } = await request.json();
    
    if (!userId || !channelId) {
      return NextResponse.json({ error: 'userId and channelId are required' }, { status: 400 });
    }

    const serverId = process.env.HARDCODED_GUILD_ID || 'default';
    
    // Generate leaderboard GIF using existing headless page
    const gifUrl = await generateLeaderboardGifFromPage(serverId);
    
    if (gifUrl) {
      await sendDiscordMessage(channelId, { content: gifUrl });
    }
    
    // Get user's personal stats for ephemeral response
    const userStats = username ? await getUserRank(serverId, username) : null;
    
    return NextResponse.json({ 
      success: true,
      gifUrl,
      userStats: userStats ? {
        points: userStats.points,
        rank: userStats.rank,
        message: `You have ${userStats.points} points and are ranked #${userStats.rank}!`
      } : null
    });
  } catch (error) {
    console.error('[LeaderboardGif] Error:', error);
    return NextResponse.json({ error: 'Failed to generate leaderboard' }, { status: 500 });
  }
}