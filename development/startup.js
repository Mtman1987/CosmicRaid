#!/usr/bin/env node
/**
 * Automated startup script for Cosmic Raid local services
 * Handles ngrok tunnel, local server, and Firestore registration
 */

const { spawn } = require('child_process');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const NGROK_DOMAIN = 'unostensible-carola-preallied.ngrok-free.dev';
const LOCAL_PORT = 5500;
const SERVER_ID = '1240832965865635881';

let localServer = null;
let ngrokProcess = null;

async function checkNgrokInstalled() {
  return new Promise((resolve) => {
    exec('ngrok version', (error) => {
      resolve(!error);
    });
  });
}

async function startNgrokTunnel() {
  console.log('🌐 Starting ngrok tunnel...');
  
  return new Promise((resolve, reject) => {
    ngrokProcess = spawn('ngrok', ['http', LOCAL_PORT, '--domain', NGROK_DOMAIN], {
      stdio: 'pipe'
    });

    let tunnelReady = false;
    
    ngrokProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('started tunnel') || output.includes('Session Status')) {
        if (!tunnelReady) {
          tunnelReady = true;
          console.log(`✅ Tunnel active: https://${NGROK_DOMAIN}`);
          resolve(`https://${NGROK_DOMAIN}`);
        }
      }
    });

    ngrokProcess.stderr.on('data', (data) => {
      console.error('ngrok error:', data.toString());
    });

    ngrokProcess.on('close', (code) => {
      if (code !== 0 && !tunnelReady) {
        reject(new Error(`ngrok exited with code ${code}`));
      }
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      if (!tunnelReady) {
        reject(new Error('ngrok tunnel timeout'));
      }
    }, 10000);
  });
}

async function startLocalServer() {
  console.log('🚀 Starting local services...');
  
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'local-services.js');
    localServer = spawn('node', [serverPath], {
      stdio: 'pipe',
      env: { ...process.env, PORT: LOCAL_PORT }
    });

    let serverReady = false;

    localServer.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(output.trim());
      
      if (output.includes('Local services running') && !serverReady) {
        serverReady = true;
        resolve();
      }
    });

    localServer.stderr.on('data', (data) => {
      console.error('Server error:', data.toString());
    });

    localServer.on('close', (code) => {
      if (code !== 0 && !serverReady) {
        reject(new Error(`Local server exited with code ${code}`));
      }
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Local server startup timeout'));
      }
    }, 5000);
  });
}

async function registerTunnel(tunnelUrl) {
  console.log('📝 Registering tunnel with Firestore...');
  
  return new Promise((resolve, reject) => {
    const registerScript = path.join(__dirname, 'add-puppeteer-tunnel.js');
    const registerProcess = spawn('node', [registerScript, tunnelUrl, SERVER_ID], {
      stdio: 'pipe'
    });

    registerProcess.stdout.on('data', (data) => {
      console.log(data.toString().trim());
    });

    registerProcess.stderr.on('data', (data) => {
      console.error(data.toString().trim());
    });

    registerProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Registration failed with code ${code}`));
      }
    });
  });
}

async function cleanup() {
  console.log('\n🛑 Shutting down services...');
  
  if (localServer) {
    localServer.kill();
    console.log('✅ Local server stopped');
  }
  
  if (ngrokProcess) {
    ngrokProcess.kill();
    console.log('✅ ngrok tunnel stopped');
  }
  
  process.exit(0);
}

async function main() {
  console.log('🎮 Cosmic Raid Local Services Startup');
  console.log('=====================================\n');

  try {
    // Check ngrok installation
    const ngrokInstalled = await checkNgrokInstalled();
    if (!ngrokInstalled) {
      throw new Error('ngrok not installed. Please install ngrok first.');
    }

    // Start local server
    await startLocalServer();
    
    // Start ngrok tunnel
    const tunnelUrl = await startNgrokTunnel();
    
    // Register tunnel with Firestore
    await registerTunnel(tunnelUrl);
    
    console.log('\n🎉 All services started successfully!');
    console.log(`📸 Screenshot service: ${tunnelUrl}/api/screenshot`);
    console.log(`💓 Heartbeat endpoint: ${tunnelUrl}/heartbeat`);
    console.log('\nPress Ctrl+C to stop all services\n');

  } catch (error) {
    console.error('❌ Startup failed:', error.message);
    await cleanup();
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start everything
main().catch(console.error);