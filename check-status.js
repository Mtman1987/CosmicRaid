#!/usr/bin/env node
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function checkStatus() {
  console.log('🔍 Checking CosmicRaid Local Services Status\n');
  
  // Check if processes are running
  console.log('📋 Process Status:');
  try {
    if (process.platform === 'win32') {
      const result = spawn('tasklist', ['/fi', 'imagename eq ngrok.exe'], { stdio: 'pipe' });
      result.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('ngrok.exe')) {
          console.log('   ✅ ngrok.exe is running');
        } else {
          console.log('   ❌ ngrok.exe is NOT running');
        }
      });
      
      const nodeResult = spawn('tasklist', ['/fi', 'imagename eq node.exe'], { stdio: 'pipe' });
      nodeResult.stdout.on('data', (data) => {
        const output = data.toString();
        const nodeCount = (output.match(/node\.exe/g) || []).length;
        console.log(`   📊 node.exe processes: ${nodeCount}`);
      });
    }
  } catch (error) {
    console.log('   ❌ Could not check processes');
  }
  
  // Check ngrok API
  console.log('\n🌐 ngrok API Status:');
  try {
    const response = await fetch('http://127.0.0.1:4040/api/tunnels');
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ ngrok API accessible');
      console.log(`   📊 Active tunnels: ${data.tunnels?.length || 0}`);
      
      if (data.tunnels?.length > 0) {
        data.tunnels.forEach(tunnel => {
          console.log(`   🚇 ${tunnel.public_url} → ${tunnel.config.addr}`);
        });
      }
    } else {
      console.log('   ❌ ngrok API returned error:', response.status);
    }
  } catch (error) {
    console.log('   ❌ ngrok API not accessible:', error.message);
  }
  
  // Check local dev server
  console.log('\n🎬 Local Dev Server (port 3300):');
  try {
    const response = await fetch('http://localhost:3300/health');
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Dev server is running');
      console.log('   📊 Status:', data);
    } else {
      console.log('   ❌ Dev server returned error:', response.status);
    }
  } catch (error) {
    console.log('   ❌ Dev server not accessible:', error.message);
  }
  
  // Check tunnel status file
  console.log('\n📄 Tunnel Status File:');
  try {
    if (fs.existsSync('.tunnel-status.json')) {
      const status = JSON.parse(fs.readFileSync('.tunnel-status.json', 'utf8'));
      console.log('   📊 Last updated:', status.lastUpdated);
      console.log('   🚇 Tunnel status:', status.tunnel?.status);
      console.log('   🌐 Tunnel URL:', status.tunnel?.url);
      console.log('   🎬 Server status:', status.server?.status);
      if (status.tunnel?.error) {
        console.log('   ❌ Error:', status.tunnel.error);
      }
    } else {
      console.log('   ❌ Status file not found');
    }
  } catch (error) {
    console.log('   ❌ Could not read status file:', error.message);
  }
  
  console.log('\n💡 Tips:');
  console.log('   • If ngrok is not running: Start it manually with "ngrok http 3300"');
  console.log('   • If dev server is not running: Run "npm run dev:hosted"');
  console.log('   • Check the system tray for the CosmicRaid icon');
  console.log('   • Right-click the tray icon to see options');
}

checkStatus().catch(console.error);