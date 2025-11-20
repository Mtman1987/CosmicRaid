const { spawn } = require('child_process');

console.log('🚀 Starting Cosmic Raid Local Services...');

// Start the dev server
const devServer = spawn('npm', ['run', 'dev:hosted'], {
  stdio: 'inherit',
  shell: true
});

console.log('✅ Service running on http://localhost:3300');
console.log('📋 To create tunnel manually, run: ngrok http 3300');

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  devServer.kill();
  process.exit(0);
});