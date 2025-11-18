#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const port = process.env.HOSTED_DEV_PORT || '3300';

async function startSimpleTunnel() {
  console.log('🚀 Starting simple ngrok tunnel...');
  
  // Kill any existing ngrok processes
  console.log('🔄 Cleaning up existing tunnels...');
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/f', '/im', 'ngrok.exe'], { stdio: 'ignore' });
    } else {
      spawn('pkill', ['-f', 'ngrok'], { stdio: 'ignore' });
    }
  } catch (error) {
    // Ignore cleanup errors
  }
  
  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Start ngrok tunnel
  console.log(`📡 Creating ngrok tunnel for port ${port}...`);
  const timestamp = Date.now().toString().slice(-6);
  const ngrokProcess = spawn('ngrok', ['http', port, '--subdomain', `cosmic-${timestamp}`], {
    stdio: 'pipe'
  });
  
  let tunnelUrl = null;
  
  ngrokProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(output);
    
    // Look for tunnel URL in output
    const urlMatch = output.match(/https:\/\/[a-zA-Z0-9-]+\.ngrok-free\.dev/);
    if (urlMatch && !tunnelUrl) {
      tunnelUrl = urlMatch[0];
      console.log(`✅ Tunnel created: ${tunnelUrl}`);
      
      // Update Firestore with tunnel URL
      console.log('📝 Updating Firestore with tunnel URL...');
      const updateProc = spawn(
        process.platform === 'win32' ? 'node.exe' : 'node',
        ['add-puppeteer-tunnel.js', tunnelUrl],
        { cwd: projectRoot, stdio: 'inherit' }
      );
    }
  });
  
  ngrokProcess.stderr.on('data', (data) => {
    console.error('ngrok error:', data.toString());
  });
  
  ngrokProcess.on('exit', (code) => {
    console.log(`ngrok exited with code ${code}`);
    process.exit(code);
  });
  
  // Handle cleanup
  const cleanup = () => {
    console.log('\\n🛑 Shutting down...');
    ngrokProcess.kill();
    process.exit(0);
  };
  
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startSimpleTunnel().catch(console.error);