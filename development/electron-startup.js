#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

/**
 * Electron-optimized startup script that runs all services concurrently
 * in a single hidden command window for minimal resource usage
 */

let services = [];

function startConcurrentServices() {
  console.log('[Electron] Starting local services directly...');
  
  // Start local services directly
  const localServices = spawn('node', ['local-services.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    windowsHide: true,
    shell: true,
    env: {
      ...process.env,
      PORT: '5500',
      ELECTRON_MODE: '1'
    }
  });

  services.push(localServices);

  localServices.stdout.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`[LocalServices] ${line.trim()}`);
      }
    });
    
    if (output.includes('Local services running') || output.includes('started server')) {
      console.log('[System] Local services ready, starting ngrok tunnel...');
      startNgrokTunnel();
      process.send && process.send({ type: 'ready' });
    }
  });

  localServices.stderr.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      if (line.trim()) {
        console.error(`[LocalServices] ${line.trim()}`);
      }
    });
  });

  localServices.on('exit', (code) => {
    console.log(`[LocalServices] Exited with code ${code}`);
    process.send && process.send({ type: 'exit', code });
  });

  return localServices;
}

function startNgrokTunnel() {
  console.log('[System] Starting ngrok tunnel on port 5500...');
  
  const ngrok = spawn('ngrok', ['http', '5500'], {
    stdio: 'pipe',
    windowsHide: true,
    shell: true
  });

  services.push(ngrok);

  ngrok.stdout.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`[Ngrok] ${line.trim()}`);
      }
    });
    
    if (output.includes('started tunnel') || output.includes('https://')) {
      console.log('[System] Ngrok tunnel created, updating Firestore...');
      setTimeout(() => updateTunnelUrl(), 2000);
    }
  });

  ngrok.stderr.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      if (line.trim()) {
        console.error(`[Ngrok] ${line.trim()}`);
      }
    });
  });
}

function updateTunnelUrl() {
  console.log('[System] Updating tunnel URL in Firestore...');
  
  const updateScript = spawn('node', ['add-puppeteer-tunnel.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    windowsHide: true,
    shell: true
  });

  updateScript.stdout.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      if (line.trim()) {
        console.log(`[TunnelUpdate] ${line.trim()}`);
      }
    });
  });

  updateScript.stderr.on('data', (data) => {
    const output = data.toString();
    output.split('\n').forEach(line => {
      if (line.trim()) {
        console.error(`[TunnelUpdate] ${line.trim()}`);
      }
    });
  });
}

function cleanup() {
  console.log('[Electron] Cleaning up services...');
  services.forEach(service => {
    if (service && !service.killed) {
      service.kill('SIGTERM');
    }
  });
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('message', (msg) => {
  if (msg.type === 'shutdown') {
    cleanup();
  }
});

// Start all services
startConcurrentServices();