#!/usr/bin/env node
/**
 * Test script to verify image generation and tunnel connectivity
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const statusFile = path.join(projectRoot, '.tunnel-status.json');

async function testImageGeneration() {
  console.log('🧪 Testing image generation pipeline...\n');
  
  const serverId = process.argv[2] || '1240832965865635881';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  console.log(`📊 Test Configuration:`);
  console.log(`   Server ID: ${serverId}`);
  console.log(`   Base URL: ${baseUrl}\n`);
  
  // Test 1: Check if headless pages are accessible
  console.log('1️⃣ Testing headless page accessibility...');
  
  try {
    const calendarUrl = `${baseUrl}/headless/calendar/${serverId}`;
    console.log(`   Testing: ${calendarUrl}`);
    
    const calendarResponse = await fetch(calendarUrl, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (calendarResponse.ok) {
      console.log('   ✅ Calendar page accessible');
    } else {
      console.log(`   ❌ Calendar page returned ${calendarResponse.status}`);
    }
    
    const leaderboardUrl = `${baseUrl}/headless/leaderboard/${serverId}`;
    console.log(`   Testing: ${leaderboardUrl}`);
    
    const leaderboardResponse = await fetch(leaderboardUrl, {
      signal: AbortSignal.timeout(10000)
    });
    
    if (leaderboardResponse.ok) {
      console.log('   ✅ Leaderboard page accessible');
    } else {
      console.log(`   ❌ Leaderboard page returned ${leaderboardResponse.status}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error testing headless pages: ${error.message}`);
  }
  
  // Test 2: Check tunnel status
  console.log('\n2️⃣ Checking tunnel status...');
  
  if (fs.existsSync(statusFile)) {
    try {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      console.log(`   Tunnel: ${status.tunnel?.status || 'unknown'}`);
      console.log(`   URL: ${status.tunnel?.url || 'none'}`);
      
      if (status.tunnel?.url && status.tunnel?.status === 'connected') {
        try {
          const healthResponse = await fetch(`${status.tunnel.url}/health`, {
            signal: AbortSignal.timeout(5000)
          });
          
          if (healthResponse.ok) {
            console.log('   ✅ Tunnel health check passed');
          } else {
            console.log(`   ❌ Tunnel health check failed: ${healthResponse.status}`);
          }
        } catch (error) {
          console.log(`   ❌ Tunnel not reachable: ${error.message}`);
        }
      } else {
        console.log('   ⚠️  Tunnel not running');
      }
    } catch (error) {
      console.log(`   ❌ Error reading tunnel status: ${error.message}`);
    }
  } else {
    console.log('   ⚠️  No tunnel status file found');
  }
  
  // Test 3: Test image generation API
  console.log('\n3️⃣ Testing image generation...');
  
  try {
    // Import the image generation functions
    const { generateCalendarImage } = require('../src/ai/flows/generate-calendar-image.ts');
    const { generateLeaderboardImage } = require('../src/ai/flows/generate-leaderboard-image.ts');
    
    console.log('   Testing calendar image generation...');
    const calendarImage = await generateCalendarImage(serverId);
    
    if (calendarImage && calendarImage.startsWith('data:image/png;base64,')) {
      console.log('   ✅ Calendar image generated successfully');
      console.log(`   📏 Image size: ~${Math.round(calendarImage.length / 1024)}KB`);
    } else {
      console.log('   ❌ Calendar image generation failed');
    }
    
    console.log('   Testing leaderboard image generation...');
    const leaderboardImage = await generateLeaderboardImage(serverId);
    
    if (leaderboardImage && leaderboardImage.startsWith('data:image/png;base64,')) {
      console.log('   ✅ Leaderboard image generated successfully');
      console.log(`   📏 Image size: ~${Math.round(leaderboardImage.length / 1024)}KB`);
    } else {
      console.log('   ❌ Leaderboard image generation failed');
    }
    
  } catch (error) {
    console.log(`   ❌ Error testing image generation: ${error.message}`);
  }
  
  console.log('\n🏁 Test completed!');
  console.log('\n💡 Tips:');
  console.log('   - If headless pages fail, check if Next.js dev server is running');
  console.log('   - If tunnel fails, run: npm run electron:tunnel');
  console.log('   - If image generation fails, check Puppeteer installation');
}

testImageGeneration().catch(console.error);