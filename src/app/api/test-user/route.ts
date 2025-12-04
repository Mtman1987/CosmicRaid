import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/firebase/server-init';

export async function POST(request: NextRequest) {
  try {
    const serverId = '1240832965865635881';
    const testUserId = 'test_user_123';
    
    // Add/update userServerMappings
    await db.collection('userServerMappings').doc(testUserId).set({
      userId: testUserId,
      serverId: serverId,
      twitchUsername: 'testuser',
      source: 'test-data',
      updatedAt: new Date(),
      lastSeen: new Date(),
      isOnline: true
    }, { merge: true });
    
    // Add/update Discord users collection
    await db.collection('servers').doc(serverId).collection('users').doc(testUserId).set({
      id: testUserId,
      discordUserId: testUserId,
      username: 'testuser',
      displayName: 'Test User',
      avatarUrl: 'https://cdn.discordapp.com/embed/avatars/0.png',
      roles: ['Community'],
      group: 'Community',
      isOnline: true,
      topic: 'Test user for avatar display',
      lastSeen: new Date()
    }, { merge: true });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Test user created/updated successfully' 
    });
  } catch (error) {
    console.error('Error creating test user:', error);
    return NextResponse.json({ 
      error: 'Failed to create test user' 
    }, { status: 500 });
  }
}