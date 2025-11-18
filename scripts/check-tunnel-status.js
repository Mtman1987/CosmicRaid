#!/usr/bin/env node
/**
 * Check tunnel status and test connectivity
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const statusFile = path.join(projectRoot, '.tunnel-status.json');

async function checkTunnelStatus() {
  console.log('🔍 Checking tunnel status...\n');
  
  // Check status file
  if (!fs.existsSync(statusFile)) {
    console.log('❌ No tunnel status file found');
    console.log('   Run: npm run electron:tunnel');
    return;
  }
  
  try {
    const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    
    console.log('📊 Tunnel Status:');
    console.log(`   Tunnel: ${status.tunnel?.status || 'unknown'}`);
    console.log(`   URL: ${status.tunnel?.url || 'none'}`);
    console.log(`   Server: ${status.server?.status || 'unknown'} (port ${status.server?.port || 'unknown'})`);
    console.log(`   Puppeteer: ${status.puppeteer?.status || 'unknown'}`);
    console.log(`   FFmpeg: ${status.ffmpeg?.status || 'unknown'}`);
    console.log(`   Last Updated: ${status.lastUpdated || 'unknown'}\n`);
    
    // Test connectivity if tunnel is running
    if (status.tunnel?.url && status.tunnel?.status === 'connected') {
      console.log('🧪 Testing tunnel connectivity...');
      
      try {
        const response = await fetch(`${status.tunnel.url}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          const health = await response.json();
          console.log('✅ Tunnel is accessible');
          console.log(`   Health: ${health.status || 'unknown'}`);
          console.log(`   Services: ${JSON.stringify(health.services || {})}`);
        } else {
          console.log(`❌ Tunnel responded with ${response.status}`);
        }
      } catch (error) {
        console.log(`❌ Tunnel connectivity test failed: ${error.message}`);
      }
    } else {
      console.log('⚠️  Tunnel not running or not connected');
    }
    
  } catch (error) {
    console.error('❌ Error reading status file:', error.message);
  }
}

checkTunnelStatus().catch(console.error);