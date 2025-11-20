import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSpotlight } from '@/lib/community-spotlight-service';
import { db } from '@/firebase/server-init';

export async function GET(request: NextRequest) {
  const serverId = request.nextUrl.searchParams.get('serverId');
  const action = request.nextUrl.searchParams.get('action');
  
  if (!serverId) {
    return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
  }

  try {
    if (action === 'online-members') {
      // Get online community members
      const usersRef = db.collection('servers').doc(serverId).collection('users');
      const snapshot = await usersRef
        .where('group', '==', 'Community')
        .where('isOnline', '==', true)
        .get();
      
      const onlineMembers = snapshot.docs
        .map(doc => doc.data().username)
        .filter(Boolean);
      
      return NextResponse.json({ 
        onlineMembers,
        count: onlineMembers.length 
      });
    }
    
    // Default: get spotlight
    const spotlight = await getCurrentSpotlight(serverId);
    return NextResponse.json({ spotlight });
  } catch (error) {
    console.error('[CommunitySpotlightAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { serverId, action } = await request.json();
  
  if (!serverId) {
    return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
  }

  try {
    if (action === 'online-members') {
      // Get online community members
      const usersRef = db.collection('servers').doc(serverId).collection('users');
      const snapshot = await usersRef
        .where('group', '==', 'Community')
        .where('isOnline', '==', true)
        .get();
      
      const onlineMembers = snapshot.docs
        .map(doc => doc.data().username)
        .filter(Boolean);
      
      return NextResponse.json({ 
        onlineMembers,
        count: onlineMembers.length 
      });
    }
    
    // Default: get spotlight
    const spotlight = await getCurrentSpotlight(serverId);
    return NextResponse.json({ spotlight });
  } catch (error) {
    console.error('[CommunitySpotlightAPI] Error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
