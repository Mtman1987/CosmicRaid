#!/usr/bin/env node
const admin = require('firebase-admin');

async function checkTunnelStatus() {
  try {
    // Initialize Firebase Admin
    const serviceAccount = require('../studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    const db = admin.firestore();

    console.log('🔍 Checking tunnel status...\n');

    // Check Firestore for tunnel URL
    const doc = await db.collection('servers').doc('1240832965865635881').collection('config').doc('secrets').get();
    
    if (doc.exists) {
      const data = doc.data();
      const tunnelUrl = data.PUPPETEER_SERVICE_URL;
      console.log('📡 Firestore PUPPETEER_SERVICE_URL:', tunnelUrl);
      
      if (tunnelUrl) {
        // Test tunnel health
        console.log('\n🏥 Testing tunnel health...');
        try {
          const response = await fetch(`${tunnelUrl}/health`);
          if (response.ok) {
            const result = await response.json();
            console.log('✅ Tunnel is healthy:', result);
          } else {
            console.log('❌ Tunnel unhealthy:', response.status, response.statusText);
          }
        } catch (error) {
          console.log('❌ Tunnel connection failed:', error.message);
        }
      }
    } else {
      console.log('❌ No secrets document found in Firestore');
    }

    // Check ngrok status
    console.log('\n🌐 Checking ngrok status...');
    try {
      const ngrokResponse = await fetch('http://localhost:4040/api/tunnels');
      if (ngrokResponse.ok) {
        const tunnels = await ngrokResponse.json();
        console.log('🚇 Active tunnels:', tunnels.tunnels.length);
        tunnels.tunnels.forEach(tunnel => {
          console.log(`  - ${tunnel.public_url} → ${tunnel.config.addr}`);
        });
      }
    } catch (error) {
      console.log('❌ ngrok API not accessible:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

checkTunnelStatus();