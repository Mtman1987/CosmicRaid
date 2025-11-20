const { spawn } = require('child_process');
const path = require('path');
const ngrok = require('ngrok');

let localServer = null;
let tunnelUrl = null;

async function startServices() {
  console.log('🚀 Starting local services with ngrok tunnel...');
  
  // Start local services first (run from the development folder explicitly)
  console.log('🛠️ Starting local services on port 5500...');
  const servicePath = path.join(__dirname, 'local-services.js');
  localServer = spawn('node', [servicePath], {
    stdio: 'inherit'
  });
  
  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Create ngrok tunnel
    console.log('📡 Creating ngrok tunnel...');
    const authtoken = process.env.NGROK_AUTHTOKEN || process.env.NGROK_TOKEN;
    tunnelUrl = await ngrok.connect({
      addr: 5500,
      authtoken,
      authtoken_from_env: true,
    });
    console.log(`✅ Tunnel created: ${tunnelUrl}`);
    
    // Update Firestore with tunnel URL
    console.log('📝 Updating Firestore with tunnel URL...');
    const updateScript = path.join(__dirname, 'add-puppeteer-tunnel.js');
    const updateProc = spawn('node', [updateScript, tunnelUrl], {
      stdio: 'inherit'
    });
    
    await new Promise((resolve) => {
      updateProc.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Firestore updated successfully');
        } else {
          console.log('⚠️ Firestore update failed, but tunnel is still active');
        }
        resolve();
      });
    });
    
    console.log('\n🚦 Services ready!');
    console.log(`🖼️ Screenshot endpoint: ${tunnelUrl}/api/screenshot`);
    console.log(`✅ Health check: ${tunnelUrl}/health`);
    
  } catch (error) {
    console.error('❌ Failed to create tunnel:', error?.message || error);
    if (!process.env.NGROK_AUTHTOKEN && !process.env.NGROK_TOKEN) {
      console.error('ℹ️  Set NGROK_AUTHTOKEN (or NGROK_TOKEN) env var: ngrok config add-authtoken <token>');
    }
    console.log('🛠️ Local services still available at http://localhost:5500');
  }
}

const cleanup = async () => {
  console.log('\n⏻ Shutting down...');
  if (localServer) localServer.kill();
  if (tunnelUrl) await ngrok.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startServices();
