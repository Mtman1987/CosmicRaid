const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function testLocalService() {
  const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL || 'http://localhost:3300';
  const calendarUrl = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/headless/calendar/1240832965865635881';
  
  console.log('📸 Testing Local Puppeteer/FFmpeg service...');
  console.log('Service URL:', localServiceUrl);
  console.log('Calendar URL:', calendarUrl);
  
  try {
    // First check if service is available
    console.log('\n🔍 Checking service health...');
    const healthResponse = await fetch(`${localServiceUrl}/health`);
    
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.status}`);
    }
    
    const healthData = await healthResponse.json();
    console.log('✅ Service is healthy:', healthData);
    
    // Take screenshot using local service
    console.log('\n📤 Taking screenshot...');
    const screenshotResponse = await fetch(`${localServiceUrl}/api/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: calendarUrl,
        width: 1280,
        height: 660,
        waitFor: 3000,
        deviceScaleFactor: 1
      })
    });
    
    if (!screenshotResponse.ok) {
      const errorText = await screenshotResponse.text();
      throw new Error(`Screenshot failed: ${screenshotResponse.status} ${errorText}`);
    }
    
    const screenshotData = await screenshotResponse.json();
    console.log('✅ Screenshot taken successfully!');
    
    if (screenshotData.dataUrl) {
      console.log('📥 Data URL received (length):', screenshotData.dataUrl.length);
      console.log('🖼️ Image format:', screenshotData.dataUrl.substring(0, 50) + '...');
    }
    
    if (screenshotData.imageUrl) {
      console.log('📥 Image URL:', screenshotData.imageUrl);
    }
    
    return screenshotData;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

testLocalService();