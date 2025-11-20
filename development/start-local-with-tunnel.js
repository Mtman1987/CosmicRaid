const { spawn } = require('child_process');
const ngrok = require('ngrok');

let localServer = null;
let tunnelUrl = null;

async function startServices() {
  console.log('🚀 Starting local services with ngrok tunnel...');
  
  // Start local services first
  console.log('📡 Starting local services on port 5500...');
  localServer = spawn('node', ['local-services.js'], {
    stdio: 'inherit'
  });
  
  // Wait a moment for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Create ngrok tunnel
    console.log('🌐 Creating ngrok tunnel...');
    tunnelUrl = await ngrok.connect(5500);
    console.log(`✅ Tunnel created: ${tunnelUrl}`);
    
    // Update Firestore with tunnel URL
    console.log('📝 Updating Firestore with tunnel URL...');
    const updateProc = spawn('node', ['add-puppeteer-tunnel.js', tunnelUrl], {
      stdio: 'inherit'
    });
    
    await new Promise((resolve, reject) => {
      updateProc.on('exit', (code) => {
        if (code === 0) {
          console.log('✅ Firestore updated successfully');
          resolve();
        } else {
          console.log('⚠️ Firestore update failed, but tunnel is still active');
          resolve(); // Continue anyway
        }
      });
    });
    
    console.log('\n🎉 Services ready!');
    console.log(`📸 Screenshot endpoint: ${tunnelUrl}/api/screenshot`);
    console.log(`❤️  Health check: ${tunnelUrl}/health`);
    
  } catch (error) {
    console.error('❌ Failed to create tunnel:', error.message);
    console.log('📡 Local services still available at http://localhost:3300');
  }
}

const cleanup = async () => {
  console.log('\n🛑 Shutting down...');
  if (localServer) localServer.kill();
  if (tunnelUrl) await ngrok.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

startServices();