import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server-init';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('serverId');
    
    if (!serverId) {
      return NextResponse.json({ error: 'serverId is required' }, { status: 400 });
    }

    console.log('[ActiveUsers API] Fetching for serverId:', serverId);

    // Get active users from userServerMappings (last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    let mappingsSnapshot;
    try {
      // Simple query with only serverId to avoid any composite index requirements
      mappingsSnapshot = await db.collection('userServerMappings')
        .where('serverId', '==', serverId)
        .get();
    } catch (firestoreError) {
      console.error('[ActiveUsers API] Firestore query error:', firestoreError);
      // Return empty array if Firestore has issues
      return NextResponse.json([]);
    }

    console.log('[ActiveUsers API] Found mappings:', mappingsSnapshot.size);
    const activeUsers = [];
    
    for (const doc of mappingsSnapshot.docs) {
      try {
        const mapping = doc.data();
        
        // Filter for online users and recent activity in memory
        if (!mapping.isOnline) continue;
        if (!mapping.lastSeen || mapping.lastSeen.toDate() < fiveMinutesAgo) continue;
        
        // Get user avatar from Discord users collection
        let userData = null;
        try {
          const userDoc = await db.collection('servers')
            .doc(serverId)
            .collection('users')
            .doc(mapping.userId)
            .get();
          userData = userDoc.data();
        } catch (userError) {
          console.warn('[ActiveUsers API] Failed to get user data for:', mapping.userId);
        }
        
        activeUsers.push({
          userId: mapping.userId,
          username: userData?.username || mapping.twitchUsername || 'Unknown',
          avatarUrl: userData?.avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png',
          isOnline: mapping.isOnline,
          lastSeen: mapping.lastSeen
        });
      } catch (userProcessError) {
        console.warn('[ActiveUsers API] Error processing user:', userProcessError);
      }
    }

    console.log('[ActiveUsers API] Returning users:', activeUsers.length);
    return NextResponse.json(activeUsers);
  } catch (error) {
    console.error('[ActiveUsers API] General error:', error);
    // Return empty array instead of 500 error
    return NextResponse.json([]);
  }
}