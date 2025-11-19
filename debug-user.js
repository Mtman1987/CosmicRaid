// Quick debug script to check user data
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'studio-9468926194-e03ac'
  });
}

const db = admin.firestore();

async function checkUser() {
  const serverId = '1240832965865635881';
  
  // Check group mappings
  const groupMappingsDoc = await db.collection('servers').doc(serverId).collection('config').doc('groupMappings').get();
  console.log('Group mappings:', groupMappingsDoc.data());
  
  // Find swordsmanEB
  const usersSnapshot = await db.collection('servers').doc(serverId).collection('users').get();
  
  usersSnapshot.docs.forEach(doc => {
    const userData = doc.data();
    if (userData.username && userData.username.toLowerCase().includes('swordsman')) {
      console.log('Found user:', {
        id: doc.id,
        username: userData.username,
        group: userData.group,
        roles: userData.roles,
        isOnline: userData.isOnline
      });
    }
  });
}

checkUser().catch(console.error);