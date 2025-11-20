import { NextRequest, NextResponse } from 'next/server';
import { PointsService } from '@/lib/points-service';
import { takeLeaderboardScreenshot } from '@/lib/leaderboard-screenshot-service';
import { getUserRank, generateLeaderboardGifFromPage } from '@/lib/leaderboard-service';
import { sendDiscordMessage } from '@/lib/discord-bot-service';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== process.env.BOT_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const serverId = searchParams.get('serverId') || process.env.HARDCODED_GUILD_ID || 'default';
    const format = searchParams.get('format'); // 'image' for PNG, 'gif' for GIF
    const userId = searchParams.get('userId'); // for user rank
    
    const pointsService = PointsService.getInstance();
    
    // Return user rank if userId provided
    if (userId) {
      const userRank = await pointsService.getUserRank(userId);
      const userPoints = await pointsService.getUserPoints(userId);
      
      if (!userRank) {
        return NextResponse.json({ 
          rank: null,
          points: 0,
          message: 'User is not on the leaderboard yet!'
        });
      }

      const points = typeof userPoints === 'number' ? userPoints : (userPoints as any)?.points || 0;
      const username = typeof userPoints === 'object' && userPoints ? (userPoints as any)?.username : undefined;
      const displayName = typeof userPoints === 'object' && userPoints ? (userPoints as any)?.displayName : undefined;
      
      return NextResponse.json({
        rank: userRank,
        points,
        username,
        displayName,
        message: `User is rank #${userRank} with ${points} points!`
      });
    }
    
    // Return image if format=image
    if (format === 'image') {
      const dataUrl = await takeLeaderboardScreenshot(serverId);
      
      if (!dataUrl) {
        return NextResponse.json({ error: 'Failed to generate screenshot' }, { status: 500 });
      }

      const base64Data = dataUrl.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      return new NextResponse(imageBuffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': imageBuffer.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    // Return JSON leaderboard data
    const leaderboard = await pointsService.getLeaderboard(limit, serverId);
    return NextResponse.json(leaderboard);

  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, username, channelId } = await request.json();
    
    if (!userId || !channelId) {
      return NextResponse.json({ error: 'userId and channelId are required' }, { status: 400 });
    }

    const serverId = process.env.HARDCODED_GUILD_ID || 'default';
    
    // Generate leaderboard GIF and post to Discord
    const gifUrl = await generateLeaderboardGifFromPage(serverId);
    
    if (gifUrl) {
      await sendDiscordMessage(channelId, { content: gifUrl });
    }
    
    // Get user's personal stats for response
    const userStats = username ? await getUserRank(serverId, username) : null;
    
    return NextResponse.json({ 
      success: true,
      gifUrl,
      userStats: userStats ? (() => {
        const points = typeof userStats === 'number' ? userStats : (userStats as any)?.points || 0;
        const rank = typeof userStats === 'number' ? 0 : (userStats as any)?.rank || 0;
        return {
          points,
          rank,
          message: `You have ${points} points and are ranked #${rank}!`
        };
      })() : null
    });
  } catch (error) {
    console.error('[LeaderboardGif] Error:', error);
    return NextResponse.json({ error: 'Failed to generate leaderboard' }, { status: 500 });
  }
}