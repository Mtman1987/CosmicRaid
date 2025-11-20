#!/usr/bin/env node
/**
 * Quick helper to add your ngrok tunnel URL to Firestore secrets
 * 
 * Usage:
 *   node add-puppeteer-tunnel.js https://your-ngrok-url.ngrok.io
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require('../studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addPuppeteerTunnel() {
  const ngrokUrl = process.argv[2];
  const serverId = process.argv[3] || '1240832965865635881'; // Default server ID
  
  if (!ngrokUrl) {
    console.error('❌ Please provide your ngrok URL as an argument');
    console.log('\nUsage:');
    console.log('  node add-puppeteer-tunnel.js https://your-ngrok-url.ngrok.io [serverId]');
    console.log('\nExample:');
    console.log('  node add-puppeteer-tunnel.js https://abc123.ngrok.io 1240832965865635881');
    process.exit(1);
  }

  // Remove trailing slash if present
  const cleanUrl = ngrokUrl.replace(/\/$/, '');

  try {
    console.log(`📝 Adding LOCAL_CONVERSION_SERVICE_URL to server ${serverId} secrets...`);
    console.log(`   URL: ${cleanUrl}`);

    // Add to both global secrets and server-specific secrets
    await db.collection('secrets').doc('LOCAL_CONVERSION_SERVICE_URL').set({
      value: cleanUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      description: 'ngrok tunnel URL to access local Puppeteer/FFmpeg service from App Hosting'
    });

    await db.collection('servers').doc(serverId).collection('config').doc('secrets').set({
      LOCAL_CONVERSION_SERVICE_URL: cleanUrl
    }, { merge: true });

    console.log('✅ Successfully added LOCAL_CONVERSION_SERVICE_URL!');
    console.log('\nYour App Hosting deployment will now use this URL to access your local Puppeteer service.');
    console.log('\n💡 Tips:');
    console.log('  - Keep your ngrok tunnel running while testing shoutouts');
    console.log('  - Keep your local service running on port 3300 (npm run dev:hosted)');
    console.log('  - Update this URL if your ngrok URL changes');
    console.log('  - To remove: node add-puppeteer-tunnel.js REMOVE');

  } catch (error) {
    console.error('❌ Error adding PUPPETEER_SERVICE_URL:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

// Handle REMOVE command
if (process.argv[2] === 'REMOVE') {
  (async () => {
    const serverId = process.argv[3] || '1240832965865635881';
    try {
      console.log(`🗑️  Removing LOCAL_CONVERSION_SERVICE_URL from server ${serverId}...`);
      await db.collection('secrets').doc('LOCAL_CONVERSION_SERVICE_URL').delete();
      await db.collection('servers').doc(serverId).collection('config').doc('secrets').update({
        LOCAL_CONVERSION_SERVICE_URL: admin.firestore.FieldValue.delete()
      });
      console.log('✅ Successfully removed LOCAL_CONVERSION_SERVICE_URL');
      console.log('   App Hosting will now skip local service and fall back to FreeConvert API');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error removing PUPPETEER_SERVICE_URL:', error.message);
      process.exit(1);
    }
  })();
} else {
  addPuppeteerTunnel();
}
