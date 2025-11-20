import { NextRequest, NextResponse } from 'next/server';
import { getServerIdForUser } from '@/lib/user-server-mapping';
import { db } from '@/firebase/server-init';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const includeRank = searchParams.get('includeRank') === 'true';
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const serverId = await getServerIdForUser(userId);
    if (!serverId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user data
    const userDoc = await db.collection('servers').doc(serverId).collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User data not found' }, { status: 404 });
    }

    const userData = userDoc.data();

    // Get server data
    const serverDoc = await db.collection('servers').doc(serverId).get();
    const serverData = serverDoc.exists ? serverDoc.data() : {};

    const profile = {
      username: userData?.username || 'Unknown User',
      avatarUrl: userData?.avatarUrl || '',
      serverName: serverData?.name || 'Unknown Server',
      serverIcon: serverData?.iconUrl || ''
    };

    // Include rank/points data if requested
    if (includeRank) {
      const leaderboardRef = db.collection('servers').doc(serverId).collection('leaderboard');
      const userLeaderboardDoc = await leaderboardRef.doc(userId).get();
      
      if (userLeaderboardDoc.exists) {
        const leaderboardData = userLeaderboardDoc.data();
        const userPoints = leaderboardData?.points || 0;
        
        // Get user's rank by counting users with more points
        const higherRankedSnapshot = await leaderboardRef
          .where('points', '>', userPoints)
          .get();
        
        const rank = higherRankedSnapshot.size + 1;
        
        return NextResponse.json({
          ...profile,
          points: userPoints,
          rank,
          rankMessage: `🏆 **${profile.username}**, you are rank #${rank} with ${userPoints.toLocaleString()} points! 🚀\n\n${rank <= 10 ? '⭐ You\'re in the top 10! Great job!' : '💪 Keep earning points to climb higher!'}`
        });
      } else {
        return NextResponse.json({
          ...profile,
          points: 0,
          rank: null,
          rankMessage: `🚀 **${profile.username}**, you haven't earned any points yet! Start participating in the community to climb the leaderboard! 🌟`
        });
      }
    }

    return NextResponse.json(profile);

  } catch (error) {
    console.error('[API] Failed to fetch user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId, username, serverId } = await request.json();
    
    if (!userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    const finalServerId = serverId || await getServerIdForUser(userId);
    if (!finalServerId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Get user's rank and points
    const leaderboardRef = db.collection('servers').doc(finalServerId).collection('leaderboard');
    const userDoc = await leaderboardRef.doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({
        content: `🚀 **${username}**, you haven't earned any points yet! Start participating in the community to climb the leaderboard! 🌟`
      });
    }
    
    const userData = userDoc.data();
    const userPoints = userData?.points || 0;
    
    // Get user's rank by counting users with more points
    const higherRankedSnapshot = await leaderboardRef
      .where('points', '>', userPoints)
      .get();
    
    const rank = higherRankedSnapshot.size + 1;
    
    return NextResponse.json({
      content: `🏆 **${username}**, you are rank #${rank} with ${userPoints.toLocaleString()} points! 🚀\n\n${rank <= 10 ? '⭐ You\'re in the top 10! Great job!' : '💪 Keep earning points to climb higher!'}`
    });
    
  } catch (error) {
    console.error('Check rank error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}