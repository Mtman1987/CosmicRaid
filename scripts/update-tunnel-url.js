#!/usr/bin/env node
const http = require('http');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  try {
    const serviceAccount = require('../studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (error) {
    console.error('[Tunnel] Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

const db = admin.firestore();

async function waitForNgrok() {
  console.log('[Tunnel] Waiting for ngrok to start...');
  
  for (let i = 0; i < 30; i++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const url = await new Promise((resolve, reject) => {
        http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const json = JSON.parse(data);
              const tunnel = json.tunnels.find(t => t.proto === 'https');
              if (tunnel) {
                resolve(tunnel.public_url);
              } else {
                reject(new Error('No HTTPS tunnel found'));
              }
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });
      
      console.log(`[Tunnel] Found ngrok URL: ${url}`);
      
      // Update Firestore
      const serverId = '1240832965865635881';
      await db.collection('servers')
        .doc(serverId)
        .collection('config')
        .doc('secrets')
        .set({
          LOCAL_CONVERSION_SERVICE_URL: url,
          PUPPETEER_SERVICE_URL: url,
          LOCAL_CONVERSION_SERVICE_UPDATED_AT: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      
      console.log('[Tunnel] ✅ Updated Firestore with tunnel URL');
      return;
      
    } catch (error) {
      console.log(`[Tunnel] Attempt ${i + 1}/30 failed: ${error.message}`);
    }
  }
  
  console.error('[Tunnel] ❌ Failed to get ngrok URL after 30 attempts');
}

waitForNgrok();