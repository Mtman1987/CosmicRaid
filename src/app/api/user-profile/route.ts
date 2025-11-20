import { NextRequest, NextResponse } from 'next/server';
import { getServerIdByUserId } from '@/lib/user-server-mapping';
import { db } from '@/firebase/server-init';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const serverId = await getServerIdByUserId(userId);
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

    return NextResponse.json({
      username: userData?.username || 'Unknown User',
      avatarUrl: userData?.avatarUrl || '',
      serverName: serverData?.name || 'Unknown Server',
      serverIcon: serverData?.iconUrl || ''
    });

  } catch (error) {
    console.error('[API] Failed to fetch user profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}