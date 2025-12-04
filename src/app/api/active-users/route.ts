import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server-init';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');
    
    if (!serverId) {
      return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
    }

    // Get active users from userServerMappings (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const mappingsSnapshot = await db.collection('userServerMappings')
      .where('serverId', '==', serverId)
      .where('isOnline', '==', true)
      .where('lastSeen', '>', fiveMinutesAgo)
      .get();

    const activeUsers = [];
    
    for (const doc of mappingsSnapshot.docs) {
      const mapping = doc.data();
      
      // Get user avatar from Discord users collection
      const userDoc = await db.collection('servers')
        .doc(serverId)
        .collection('users')
        .doc(mapping.userId)
        .get();
      
      const userData = userDoc.data();
      
      activeUsers.push({
        userId: mapping.userId,
        username: userData?.username || mapping.twitchUsername || 'Unknown',
        avatarUrl: userData?.avatarUrl,
        isOnline: mapping.isOnline,
        lastSeen: mapping.lastSeen
      });
    }

    return NextResponse.json(activeUsers);
  } catch (error) {
    console.error('Error fetching active users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}