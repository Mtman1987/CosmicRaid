#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

/**
 * Electron-optimized startup script that runs all services concurrently
 * in a single hidden command window for minimal resource usage
 */

let services = [];

function startConcurrentServices() {
  console.log('[Electron] Starting all services concurrently...');
  
  // Use concurrently to run all services in one command window
  const concurrentProcess = spawn('npx', [
    'concurrently',
    '-k', // Kill all on exit
    '-n', 'ngrok,local-services,tunnel-update', // Service names
    '-c', 'cyan,green,yellow', // Colors
    '--kill-others-on-fail',
    '"ngrok http 5500"',
    '"node local-services.js"',
    '"node scripts/update-tunnel-url.js"'
  ], {
    stdio: 'pipe',
    windowsHide: true,
    shell: true,
    env: {
      ...process.env,
      PORT: '5500',
      ELECTRON_MODE: '1'
    }
  });

  services.push(concurrentProcess);

  concurrentProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`[Services] ${output.trim()}`);
    
    // Notify parent process when ready
    if (output.includes('Ready') || output.includes('started server') || output.includes('Local services running')) {
      process.send && process.send({ type: 'ready' });
    }
  });

  concurrentProcess.stderr.on('data', (data) => {
    console.error(`[Services] ${data.toString().trim()}`);
  });

  concurrentProcess.on('exit', (code) => {
    console.log(`[Services] Concurrent services exited with code ${code}`);
    process.send && process.send({ type: 'exit', code });
  });

  return concurrentProcess;
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