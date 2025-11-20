#!/usr/bin/env node
const { spawn } = require('child_process');

async function killServices() {
  console.log('🛑 Killing all CosmicRaid services...\n');
  
  // Kill ngrok processes
  console.log('1️⃣ Killing ngrok processes...');
  try {
    spawn('taskkill', ['/f', '/im', 'ngrok.exe'], { stdio: 'inherit' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('   ✅ ngrok processes killed');
  } catch (error) {
    console.log('   ❌ No ngrok processes found');
  }
  
  // Kill node processes (be careful - this might kill other node apps)
  console.log('2️⃣ Killing node processes with "dev:hosted"...');
  try {
    // More targeted approach - kill processes listening on port 3300
    spawn('netstat', ['-ano'], { stdio: 'pipe' }).stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.includes(':3300') && line.includes('LISTENING')) {
          const parts = line.trim().split(/\s+/);
          const pid = parts[parts.length - 1];
          if (pid && !isNaN(pid)) {
            console.log(`   🎯 Killing process on port 3300 (PID: ${pid})`);
            spawn('taskkill', ['/f', '/pid', pid], { stdio: 'inherit' });
          }
        }
      });
    });
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('   ✅ Port 3300 processes killed');
  } catch (error) {
    console.log('   ❌ Could not kill port 3300 processes');
  }
  
  console.log('\n✅ Cleanup complete!');
  console.log('💡 You can now safely restart services');
}

killServices().catch(console.error);