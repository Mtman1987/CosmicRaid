#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixTunnel() {
  console.log('🔧 Fixing tunnel connection...\n');
  
  // Step 1: Kill existing ngrok processes
  console.log('1️⃣ Cleaning up existing ngrok processes...');
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/f', '/im', 'ngrok.exe'], { stdio: 'ignore' });
    } else {
      spawn('pkill', ['-f', 'ngrok'], { stdio: 'ignore' });
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.log('   No existing processes to clean up');
  }
  
  // Step 2: Start fresh ngrok tunnel
  console.log('2️⃣ Starting fresh ngrok tunnel...');
  const ngrokProcess = spawn('ngrok', ['http', '3300'], {
    stdio: 'pipe',
    windowsHide: true
  });
  
  // Wait for ngrok to start
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 3: Get tunnel URL
  console.log('3️⃣ Getting tunnel URL...');
  try {
    const url = await getNgrokUrl();
    console.log(`   ✅ Tunnel URL: ${url}`);
    
    // Step 4: Update Firestore
    console.log('4️⃣ Updating Firestore...');
    await updateFirestore(url);
    console.log('   ✅ Firestore updated');
    
    // Step 5: Update tunnel status file
    console.log('5️⃣ Updating tunnel status...');
    const fs = require('fs');
    const status = {
      tunnel: {
        status: 'active',
        url: url,
        error: null
      },
      server: {
        status: 'ready',
        port: 3300
      },
      puppeteer: {
        status: 'available'
      },
      ffmpeg: {
        status: 'available'
      },
      lastUpdated: new Date().toISOString(),
      port: '3300'
    };
    
    fs.writeFileSync('.tunnel-status.json', JSON.stringify(status, null, 2));
    console.log('   ✅ Status file updated');
    
    console.log('\n🎉 Tunnel fixed successfully!');
    console.log(`📡 Your tunnel: ${url}`);
    console.log('🚀 You can now start your dev server with: npm run dev:hosted');
    
  } catch (error) {
    console.error(`❌ Failed to fix tunnel: ${error.message}`);
    ngrokProcess.kill();
    process.exit(1);
  }
}

async function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const tunnel = json.tunnels?.find(t => t.proto === 'https');
          
          if (!tunnel) {
            reject(new Error('No HTTPS tunnel found'));
            return;
          }
          
          resolve(tunnel.public_url);
        } catch (error) {
          reject(new Error(`Failed to parse ngrok response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to connect to ngrok API: ${error.message}`));
    });
  });
}

async function updateFirestore(url) {
  const serverId = '1240832965865635881';
  await db.collection('servers')
    .doc(serverId)
    .collection('config')
    .doc('secrets')
    .set({
      PUPPETEER_SERVICE_URL: url,
      PUPPETEER_SERVICE_UPDATED_AT: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
}

fixTunnel().catch(console.error);