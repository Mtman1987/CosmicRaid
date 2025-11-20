// Quick script to check if users exist in Firestore
const admin = require('firebase-admin');

const serviceAccount = require('./studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const serverId = '1240832965865635881';

async function checkUsers() {
  console.log('Checking users for server:', serverId);
  
  const usersSnapshot = await db
    .collection('servers')
    .doc(serverId)
    .collection('users')
    .limit(10)
    .get();

  console.log('\nTotal users found:', usersSnapshot.size);
  
  if (usersSnapshot.empty) {
    console.log('\n❌ NO USERS FOUND! You need to sync Discord data.');
    console.log('Go to Settings page and click "Sync Discord Data"');
  } else {
    console.log('\n✅ Users exist in database:');
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`  - ${data.username} (${doc.id}): online=${data.isOnline}, group=${data.group}`);
    });
  }
  
  process.exit(0);
}

checkUsers().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
