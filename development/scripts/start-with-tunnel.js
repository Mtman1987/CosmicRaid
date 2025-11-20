#!/usr/bin/env node
const { spawn } = require('child_process');
const ngrok = require('ngrok');
const path = require('path');
const fs = require('fs');

const projectRoot = path.join(__dirname, '..');
const port = process.env.HOSTED_DEV_PORT || '3300';
const statusFile = path.join(projectRoot, '.tunnel-status.json');

let tunnelUrl = null;
let serverProcess = null;

// Update status file
function updateStatus(status) {
  const statusData = {
    ...status,
    lastUpdated: new Date().toISOString(),
    port: port
  };
  
  try {
    fs.writeFileSync(statusFile, JSON.stringify(statusData, null, 2));
  } catch (error) {
    console.error('Failed to write status file:', error);
  }
}

async function startWithTunnel() {
  console.log('🚀 Starting Cosmic Raid with ngrok tunnel...');
  
  updateStatus({
    tunnel: { status: 'starting', url: null },
    server: { status: 'starting', port: null },
    puppeteer: { status: 'checking' },
    ffmpeg: { status: 'checking' }
  });
  
  try {
    // Kill any existing ngrok tunnels first
    console.log('🔄 Cleaning up existing tunnels...');
    await ngrok.kill();
    
    // Start ngrok tunnel
    console.log(`📡 Creating ngrok tunnel for port ${port}...`);
    tunnelUrl = await ngrok.connect(port);
    console.log(`✅ Tunnel created: ${tunnelUrl}`);
    
    updateStatus({
      tunnel: { status: 'connected', url: tunnelUrl },
      server: { status: 'starting', port: null },
      puppeteer: { status: 'available' },
      ffmpeg: { status: 'available' }
    });
    
    // Update Firestore with tunnel URL
    console.log('📝 Updating Firestore with tunnel URL...');
    const updateProc = spawn(
      process.platform === 'win32' ? 'node.exe' : 'node',
      ['add-puppeteer-tunnel.js', tunnelUrl],
      { cwd: projectRoot, stdio: 'inherit' }
    );
    
    await new Promise((resolve, reject) => {
      updateProc.on('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Failed to update tunnel URL (exit code: ${code})`));
      });
    });
    
    // Start the hosted dev server
    console.log(`🖥️  Starting dev server on port ${port}...`);
    serverProcess = spawn(
      process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['run', 'dev:hosted'],
      { 
        cwd: projectRoot, 
        stdio: 'inherit',
        env: { ...process.env, PORT: port }
      }
    );
    
    updateStatus({
      tunnel: { status: 'connected', url: tunnelUrl },
      server: { status: 'running', port: port },
      puppeteer: { status: 'available' },
      ffmpeg: { status: 'available' }
    });
    
    const cleanup = async () => {
      console.log('\n🛑 Shutting down...');
      
      updateStatus({
        tunnel: { status: 'disconnecting', url: tunnelUrl },
        server: { status: 'stopping', port: port },
        puppeteer: { status: 'unavailable' },
        ffmpeg: { status: 'unavailable' }
      });
      
      if (serverProcess) serverProcess.kill();
      await ngrok.kill();
      
      // Clean up status file
      try {
        fs.unlinkSync(statusFile);
      } catch (error) {
        // Ignore cleanup errors
      }
      
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    serverProcess.on('exit', cleanup);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    
    updateStatus({
      tunnel: { status: 'error', url: null, error: error.message },
      server: { status: 'error', port: null },
      puppeteer: { status: 'unavailable' },
      ffmpeg: { status: 'unavailable' }
    });
    
    process.exit(1);
  }
}

startWithTunnel();