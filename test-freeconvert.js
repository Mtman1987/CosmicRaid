const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function testFreeConvert() {
  const apiKey = process.env.FREE_CONVERT_API_KEY;
  const testVideoUrl = 'https://clips-media-assets2.twitch.tv/vod-2320936482-offset-7506-60.mp4';
  
  console.log('🧪 Testing FreeConvert API...');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT FOUND');
  
  try {
    // Step 1: Create conversion job
    console.log('\n📤 Creating conversion job...');
    const createResponse = await fetch('https://api.freeconvert.com/v1/process/import/url', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: testVideoUrl,
        filename: 'test-clip.mp4'
      })
    });
    
    if (!createResponse.ok) {
      throw new Error(`Create job failed: ${createResponse.status} ${await createResponse.text()}`);
    }
    
    const createData = await createResponse.json();
    console.log('✅ Job created:', createData.id);
    
    // Step 2: Convert to GIF
    console.log('\n🔄 Converting to GIF...');
    const convertResponse = await fetch('https://api.freeconvert.com/v1/process/convert', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: createData.id,
        output_format: 'gif',
        options: {
          video_fps: 15,
          video_resolution: '480x270'
        }
      })
    });
    
    if (!convertResponse.ok) {
      throw new Error(`Convert failed: ${convertResponse.status} ${await convertResponse.text()}`);
    }
    
    const convertData = await convertResponse.json();
    console.log('✅ Conversion started:', convertData.id);
    
    // Step 3: Poll for completion
    console.log('\n⏳ Waiting for completion...');
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${convertData.id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const statusData = await statusResponse.json();
      console.log('Full response:', JSON.stringify(statusData, null, 2));
      console.log(`Status: ${statusData.status} (${attempts + 1}/30)`);
      
      if (statusData.status === 'completed') {
        console.log('🎉 Conversion completed!');
        console.log('Download URL:', statusData.result.url);
        return statusData.result.url;
      }
      
      if (statusData.status === 'failed') {
        throw new Error('Conversion failed: ' + JSON.stringify(statusData));
      }
      
      attempts++;
    }
    
    throw new Error('Conversion timed out');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFreeConvert();