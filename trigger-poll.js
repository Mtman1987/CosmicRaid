// Manually trigger polling to update isOnline status
const admin = require('firebase-admin');

const serviceAccount = require('./studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const serverId = '1240832965865635881';

async function triggerPoll() {
  console.log('Triggering manual poll...');
  
  // Import and run the polling service
  const { manualPoll } = require('./src/lib/polling-service.ts');
  
  try {
    await manualPoll(serverId);
    console.log('✅ Polling completed successfully!');
    console.log('Check the shoutouts page now - online users should appear.');
  } catch (error) {
    console.error('❌ Polling failed:', error);
  }
  
  process.exit(0);
}

triggerPoll();
