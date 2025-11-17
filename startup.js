#!/usr/bin/env node
/**
 * Startup script for Electron app that:
 * 1. Starts ngrok tunnel on port 3300
 * 2. Gets the public URL from ngrok
 * 3. Uploads it to Firestore as PUPPETEER_SERVICE_URL
 * 4. Starts the dev:hosted server
 * 
 * This makes your local Puppeteer/FFmpeg service accessible from App Hosting
 */

const { spawn } = require('child_process');
const http = require('http');
const admin = require('firebase-admin');

// Initialize Firebase Admin
const serviceAccount = require('./studio-9468926194-e03ac-firebase-adminsdk-fbsvc-75298e056b.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

let ngrokProcess = null;
let devServerProcess = null;
let ngrokUrl = null;
let shoutoutInterval = null;

const SHOUTOUT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Start ngrok tunnel
 */
async function startNgrok() {
  return new Promise((resolve, reject) => {
    console.log('[Startup] Starting ngrok tunnel on port 3300...');
    
    const ngrokCmd = process.platform === 'win32' ? 'ngrok.cmd' : 'ngrok';
    ngrokProcess = spawn(ngrokCmd, ['http', '3300'], {
      stdio: 'pipe',
      shell: true,
      windowsHide: true
    });

    ngrokProcess.stdout.on('data', (data) => {
      console.log(`[ngrok] ${data.toString().trim()}`);
    });

    ngrokProcess.stderr.on('data', (data) => {
      console.error(`[ngrok] ${data.toString().trim()}`);
    });

    ngrokProcess.on('error', (error) => {
      reject(new Error(`Failed to start ngrok: ${error.message}`));
    });

    // Give ngrok a moment to start
    setTimeout(() => resolve(), 3000);
  });
}

/**
 * Get ngrok public URL from local API
 */
async function getNgrokUrl() {
  return new Promise((resolve, reject) => {
    console.log('[Startup] Fetching ngrok public URL...');
    
    http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const tunnel = json.tunnels.find(t => t.proto === 'https');
          
          if (!tunnel) {
            reject(new Error('No HTTPS tunnel found'));
            return;
          }
          
          const url = tunnel.public_url;
          console.log(`[Startup] ✅ ngrok URL: ${url}`);
          resolve(url);
        } catch (error) {
          reject(new Error(`Failed to parse ngrok API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to connect to ngrok API: ${error.message}`));
    });
  });
}

/**
 * Upload ngrok URL to Firestore
 */
async function uploadToFirestore(url) {
  try {
    console.log('[Startup] Uploading PUPPETEER_SERVICE_URL to Firestore...');
    
    await db.collection('secrets').doc('PUPPETEER_SERVICE_URL').set({
      value: url,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      description: 'ngrok tunnel URL to access local Puppeteer/FFmpeg service from App Hosting'
    });
    
    console.log('[Startup] ✅ Successfully uploaded to Firestore');
  } catch (error) {
    console.error('[Startup] ❌ Failed to upload to Firestore:', error.message);
    throw error;
  }
}

/**
 * Start the dev:hosted server
 */
function startDevServer() {
  console.log('[Startup] Starting dev:hosted server on port 3300...');
  
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  devServerProcess = spawn(npmCmd, ['run', 'dev:hosted'], {
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      PUPPETEER_SERVICE_URL: ngrokUrl
    }
  });
  
  devServerProcess.on('error', (error) => {
    console.error('[Startup] ❌ Failed to start dev server:', error.message);
  });
}

/**
 * Cleanup on exit
 */
function cleanup() {
  console.log('\n[Startup] Shutting down...');
  
  if (shoutoutInterval) {
    clearInterval(shoutoutInterval);
  }
  
  if (ngrokProcess) {
    console.log('[Startup] Stopping ngrok...');
    ngrokProcess.kill();
  }
  
  if (devServerProcess) {
    console.log('[Startup] Stopping dev server...');
    devServerProcess.kill();
  }
  
  // Remove the URL from Firestore on shutdown
  db.collection('secrets').doc('PUPPETEER_SERVICE_URL').delete()
    .then(() => {
      console.log('[Startup] ✅ Cleaned up Firestore');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Startup] ❌ Failed to cleanup Firestore:', error.message);
      process.exit(1);
    });
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

/**
 * Trigger automated shoutouts on App Hosting
 */
async function triggerShoutouts() {
  try {
    const appHostingUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cosmicraid--studio-5587063777-d2e6c.us-central1.hosted.app';
    const serverId = '1240832965865635881'; // Your hardcoded server ID
    
    console.log('[Shoutouts] Triggering automated cycle...');
    
    const response = await fetch(`${appHostingUrl}/api/shoutouts/run-cycle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serverId })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('[Shoutouts] ✅ Cycle completed:', data.message || 'Success');
    } else {
      console.error('[Shoutouts] ❌ Failed:', response.status, await response.text());
    }
  } catch (error) {
    console.error('[Shoutouts] ❌ Error:', error.message);
  }
}

/**
 * Start the shoutout automation timer
 * NOTE: This is optional if you have Cloud Scheduler set up
 * Cloud Scheduler is recommended for 24/7 operation
 */
function startShoutoutTimer() {
  // Check if we should enable local pinging (default: no, rely on Cloud Scheduler)
  const enableLocalPinging = process.env.ENABLE_LOCAL_SHOUTOUT_PING === 'true';
  
  if (!enableLocalPinging) {
    console.log('[Shoutouts] Local pinging disabled (Cloud Scheduler recommended)');
    console.log('[Shoutouts] Set ENABLE_LOCAL_SHOUTOUT_PING=true to enable local pinging');
    return;
  }
  
  console.log('[Shoutouts] Starting 10-minute automation timer...');
  
  // Run immediately
  triggerShoutouts();
  
  // Then every 10 minutes
  shoutoutInterval = setInterval(triggerShoutouts, SHOUTOUT_INTERVAL_MS);
}

/**
 * Main startup sequence
 */
async function main() {
  try {
    console.log('🚀 CosmicRaid Local Services - Starting up...\n');
    
    // Step 1: Start ngrok
    await startNgrok();
    
    // Step 2: Get ngrok URL
    ngrokUrl = await getNgrokUrl();
    
    // Step 3: Upload to Firestore
    await uploadToFirestore(ngrokUrl);
    
    // Step 4: Start dev server
    startDevServer();
    
    // Step 5: Start shoutout automation
    startShoutoutTimer();
    
    console.log('\n✅ All services running!');
    console.log(`📡 ngrok: ${ngrokUrl}`);
    console.log('🎬 Puppeteer: http://localhost:3300');
    console.log('🤖 Shoutouts: Every 10 minutes');
    console.log('☁️  App Hosting can now access your local services\n');
    
  } catch (error) {
    console.error('\n❌ Startup failed:', error.message);
    cleanup();
  }
}

main();
