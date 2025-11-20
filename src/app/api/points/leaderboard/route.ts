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
    const { serverId, channelId } = await request.json();
    
    if (!serverId || !channelId) {
      return NextResponse.json({ error: 'serverId and channelId are required' }, { status: 400 });
    }
    
    // Generate leaderboard screenshot
    const dataUrl = await takeLeaderboardScreenshot(serverId);
    
    if (!dataUrl) {
      return NextResponse.json({ error: 'Failed to generate leaderboard screenshot' }, { status: 500 });
    }

    // Send image as plain attachment first
    await sendDiscordMessage(channelId, {
      files: [{
        name: 'leaderboard.png',
        data: dataUrl.split(',')[1],
        contentType: 'image/png'
      }]
    });

    // Send second message with embed and button
    await sendDiscordMessage(channelId, {
      embeds: [{
        title: '🏆 Space Mountain Leaderboard',
        description: 'Current top performers on the server',
        color: 0x8B5CF6,
        timestamp: new Date().toISOString()
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 2,
          label: 'Check My Rank',
          custom_id: `leaderboard_rank_${serverId}`,
          emoji: { name: '📊' }
        }]
      }]
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LeaderboardPost] Error:', error);
    return NextResponse.json({ error: 'Failed to post leaderboard' }, { status: 500 });
  }
}