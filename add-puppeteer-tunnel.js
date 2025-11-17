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
const serviceAccount = require('./studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function addPuppeteerTunnel() {
  const ngrokUrl = process.argv[2];
  
  if (!ngrokUrl) {
    console.error('❌ Please provide your ngrok URL as an argument');
    console.log('\nUsage:');
    console.log('  node add-puppeteer-tunnel.js https://your-ngrok-url.ngrok.io');
    console.log('\nExample:');
    console.log('  node add-puppeteer-tunnel.js https://abc123.ngrok.io');
    process.exit(1);
  }

  // Remove trailing slash if present
  const cleanUrl = ngrokUrl.replace(/\/$/, '');

  try {
    console.log(`📝 Adding PUPPETEER_SERVICE_URL to Firestore secrets...`);
    console.log(`   URL: ${cleanUrl}`);

    await db.collection('secrets').doc('PUPPETEER_SERVICE_URL').set({
      value: cleanUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      description: 'ngrok tunnel URL to access local Puppeteer/FFmpeg service from App Hosting'
    });

    console.log('✅ Successfully added PUPPETEER_SERVICE_URL!');
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
    try {
      console.log('🗑️  Removing PUPPETEER_SERVICE_URL from Firestore...');
      await db.collection('secrets').doc('PUPPETEER_SERVICE_URL').delete();
      console.log('✅ Successfully removed PUPPETEER_SERVICE_URL');
      console.log('   App Hosting will now skip Puppeteer and fall back to Twitch clips');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error removing PUPPETEER_SERVICE_URL:', error.message);
      process.exit(1);
    }
  })();
} else {
  addPuppeteerTunnel();
}
