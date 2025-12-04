import { db } from '@/firebase/server-init';

async function addTestUser() {
  const serverId = '1240832965865635881';
  const testUserId = 'test_user_123';
  
  // Add to userServerMappings
  await db.collection('userServerMappings').doc(testUserId).set({
    userId: testUserId,
    serverId: serverId,
    twitchUsername: 'testuser',
    source: 'test-data',
    updatedAt: new Date(),
    lastSeen: new Date(),
    isOnline: true
  });
  
  // Add to Discord users collection with avatar
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
  });
  
  console.log('Test user added successfully!');
}

addTestUser().catch(console.error);