// Quick fix for swordsmaneb
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'studio-9468926194-e03ac'
  });
}

const db = admin.firestore();

async function fixSwordsman() {
  const serverId = '1240832965865635881';
  const userId = '584582763215192082'; // swordsmaneb's Discord ID
  
  await db.collection('servers').doc(serverId).collection('users').doc(userId).update({
    group: 'VIP',
    isOnline: true,
    lastStatusUpdate: new Date()
  });
  
  console.log('Updated swordsmaneb: group=VIP, isOnline=true');
}

fixSwordsman().catch(console.error);