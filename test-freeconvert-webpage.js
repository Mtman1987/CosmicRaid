const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function testFreeConvertWebpage() {
  const apiKey = process.env.FREE_CONVERT_API_KEY;
  const calendarUrl = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/calendar';
  
  console.log('📸 Testing FreeConvert webpage screenshot...');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT FOUND');
  console.log('URL:', calendarUrl);
  
  try {
    const inputBody = {
      "tasks": {
        "import-1": {
          "operation": "import/webpage",
          "url": calendarUrl
        },
        "convert-1": {
          "operation": "convert",
          "input": "import-1",
          "input_format": "webpage",
          "output_format": "png",
          "options": {
            "viewport_width": 1200,
            "viewport_height": 800,
            "delay": 3000
          }
        },
        "export-1": {
          "operation": "export/url",
          "input": ["convert-1"]
        }
      }
    };
    
    console.log('\n📤 Creating job...');
    const response = await fetch('https://api.freeconvert.com/v1/process/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(inputBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Job creation failed: ${response.status} ${errorText}`);
    }
    
    const jobData = await response.json();
    console.log('✅ Job created:', jobData.id);
    
    // Poll for completion
    console.log('\n⏳ Waiting for completion...');
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      const statusData = await statusResponse.json();
      console.log(`Status: ${statusData.status} (${attempts + 1}/30)`);
      
      if (statusData.status === 'completed') {
        console.log('🎉 Screenshot completed!');
        console.log('Tasks:', Object.keys(statusData.tasks));
        
        // Find the export task result
        const exportTask = statusData.tasks['export-1'];
        if (exportTask && exportTask.result && exportTask.result.files) {
          console.log('📥 Download URL:', exportTask.result.files[0].url);
          return exportTask.result.files[0].url;
        }
        break;
      }
      
      if (statusData.status === 'failed') {
        console.log('❌ Job failed:', JSON.stringify(statusData, null, 2));
        return;
      }
      
      attempts++;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testFreeConvertWebpage();