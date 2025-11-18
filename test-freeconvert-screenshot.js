const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function testFreeConvertScreenshot() {
  const apiKey = process.env.FREE_CONVERT_API_KEY;
  const calendarUrl = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/calendar';
  
  console.log('📸 Testing FreeConvert screenshot...');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT FOUND');
  console.log('URL:', calendarUrl);
  
  try {
    // Create screenshot job
    console.log('\n📤 Creating screenshot job...');
    const createResponse = await fetch('https://api.freeconvert.com/v1/process/capture/website', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: calendarUrl,
        output_format: 'png',
        options: {
          viewport_width: 1200,
          viewport_height: 800,
          full_page: false,
          delay: 3000
        }
      })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Screenshot job failed: ${createResponse.status} ${errorText}`);
    }
    
    const createData = await createResponse.json();
    console.log('✅ Screenshot job created:', createData.id);
    
    // Poll for completion
    console.log('\n⏳ Waiting for completion...');
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${createData.id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const statusData = await statusResponse.json();
      console.log(`Status: ${statusData.status || 'unknown'} (${attempts + 1}/30)`);
      
      if (statusData.status === 'completed') {
        console.log('🎉 Screenshot completed!');
        console.log('Download URL:', statusData.result?.url || statusData.output?.url);
        return statusData.result?.url || statusData.output?.url;
      }
      
      if (statusData.status === 'failed') {
        console.log('❌ Screenshot failed:', JSON.stringify(statusData, null, 2));
        return;
      }
      
      attempts++;
    }
    
    throw new Error('Screenshot timed out');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFreeConvertScreenshot();