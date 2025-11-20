const admin = require('firebase-admin');
const serviceAccount = require('./studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'studio-5587063777-d2e6c'
});

const db = admin.firestore();

async function addBaseUrl() {
  try {
    const serverId = '1240832965865635881';
    const baseUrl = 'https://cosmicraid--studio-5587063777-d2e6c.us-central1.hosted.app';
    
    // Update the secrets document with BASE_URL
    await db.collection('servers').doc(serverId).collection('config').doc('secrets').update({
      BASE_URL: baseUrl
    });
    
    console.log(`✅ Added BASE_URL secret: ${baseUrl}`);
    console.log(`   Path: servers/${serverId}/config/secrets`);
    
  } catch (error) {
    console.error('❌ Error adding BASE_URL secret:', error);
  }
  
  process.exit(0);
}

addBaseUrl();
