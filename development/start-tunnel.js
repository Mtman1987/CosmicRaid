const { spawn } = require('child_process');
const ngrok = require('ngrok');

async function startTunnel() {
  console.log('🚀 Starting Cosmic Raid Local Services with tunnel...');
  
  // Start the Next.js dev server
  const devServer = spawn('npm', ['run', 'dev:hosted'], {
    stdio: 'inherit',
    shell: true
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 8000));

  try {
    const port = process.env.HOSTED_DEV_PORT || 3300;
    console.log(`Starting ngrok tunnel on port ${port}...`);
    
    // Start ngrok tunnel with authtoken
    const url = await ngrok.connect({
      port: port,
      authtoken: process.env.NGROK_AUTHTOKEN
    });
    
    console.log(`🌐 Tunnel active: ${url}`);
    console.log(`📋 Use this URL for LOCAL_CONVERSION_SERVICE_URL in your main app`);
    
    // Save tunnel URL to file
    require('fs').writeFileSync('.tunnel-url.txt', url);
    
  } catch (error) {
    console.error('❌ Failed to start tunnel:', error);
    console.log('Make sure ngrok is installed and authenticated');
    process.exit(1);
  }

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    try {
      await ngrok.disconnect();
    } catch (e) {}
    devServer.kill();
    process.exit(0);
  });
}

startTunnel().catch(console.error);