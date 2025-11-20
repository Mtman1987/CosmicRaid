#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const admin = require('firebase-admin');
const fs = require('fs');

// Initialize Firebase Admin
const serviceAccount = require('./studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

let devServerProcess = null;
let ngrokProcess = null;

async function startServices() {
  console.log('🚀 Starting CosmicRaid Local Services\n');
  
  // Step 1: Kill existing ngrok and start fresh
  console.log('1️⃣ Restarting ngrok on correct port...');
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/f', '/im', 'ngrok.exe'], { stdio: 'ignore' });
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Start ngrok on port 3300
  ngrokProcess = spawn('ngrok', ['http', '3300'], {
    stdio: 'pipe',
    windowsHide: true
  });
  
  console.log('   ⏳ Starting ngrok tunnel...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Step 2: Start dev server
  console.log('2️⃣ Starting dev server on port 3300...');
  devServerProcess = spawn('cmd', ['/c', 'npm', 'run', 'dev:hosted'], {
    stdio: 'pipe',
    env: { ...process.env, HOSTED_DEV_PORT: '3300' },
    shell: true
  });
  
  devServerProcess.stdout.on('data', (data) => {
    console.log(`[DEV] ${data.toString().trim()}`);
  });
  
  devServerProcess.stderr.on('data', (data) => {
    console.log(`[DEV] ${data.toString().trim()}`);
  });
  
  console.log('   ⏳ Starting dev server...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Step 3: Get tunnel URL and update Firestore
  console.log('3️⃣ Getting tunnel URL...');
  try {
    const tunnelUrl = await getNgrokUrl();
    console.log(`   ✅ Tunnel URL: ${tunnelUrl}`);
    
    // Update Firestore
    await updateFirestore(tunnelUrl);
    console.log('   ✅ Firestore updated');
    
    // Update status file
    updateStatusFile(tunnelUrl);
    console.log('   ✅ Status file updated');
    
    console.log('\n🎉 All services started successfully!');
    console.log(`📡 Tunnel: ${tunnelUrl}`);
    console.log('🎬 Dev Server: http://localhost:3300');
    console.log('💡 Press Ctrl+C to stop all services');
    
  } catch (error) {
    console.error(`❌ Failed to get tunnel URL: ${error.message}`);
    console.log('🔧 Services are running but tunnel setup failed');
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
          const tunnel = json.tunnels?.find(t => t.proto === 'https' && t.config?.addr === 'http://localhost:3300');
          
          if (!tunnel) {
            reject(new Error('No HTTPS tunnel found for port 3300'));
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

function updateStatusFile(url) {
  const status = {
    tunnel: {
      status: 'active',
      url: url,
      error: null
    },
    server: {
      status: 'running',
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
}

function cleanup() {
  console.log('\n🛑 Shutting down services...');
  
  if (ngrokProcess) {
    ngrokProcess.kill();
  }
  
  if (devServerProcess) {
    devServerProcess.kill();
  }
  
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startServices().catch(console.error);