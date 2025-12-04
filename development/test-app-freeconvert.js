const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

async function testAppFreeConvert() {
  const apiKey = process.env.FREE_CONVERT_API_KEY;
  const screenshotUrl = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/headless/leaderboard/test-guild-id';

  console.log('🧪 Testing App-style FreeConvert integration...');
  console.log('API Key:', apiKey ? `${apiKey.substring(0, 20)}...` : 'NOT FOUND');
  console.log('Target URL:', screenshotUrl);

  try {
    // Create job exactly like the app does
    console.log('\n📤 Creating job with tasks (like app)...');
    const response = await fetch('https://api.freeconvert.com/v1/process/jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "tasks": {
          "import-1": {
            "operation": "import/webpage",
            "url": screenshotUrl
          },
          "convert-1": {
            "operation": "convert",
            "input": "import-1",
            "input_format": "webpage",
            "output_format": "png",
            "options": {
              "viewport_width": 600,
              "viewport_height": 800,
              "delay": 3000
            }
          },
          "export-1": {
            "operation": "export/url",
            "input": ["convert-1"]
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Job creation failed:', response.status, errorText);
      return;
    }

    let jobData;
    try {
      jobData = await response.json();
      console.log('✅ Job created:', jobData.id);
    } catch (parseError) {
      console.log('❌ Failed to parse job creation response:', parseError.message);
      return;
    }

    if (!jobData?.id) {
      console.log('❌ No job ID in response');
      return;
    }

    // Poll for completion like the app does
    console.log('\n⏳ Polling for completion (like app)...');
    for (let i = 0; i < 20; i++) {
      console.log(`\n🔄 Attempt ${i + 1}/20 - Waiting 3 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      const statusResponse = await fetch(`https://api.freeconvert.com/v1/process/jobs/${jobData.id}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!statusResponse.ok) {
        console.log(`❌ Status check failed: ${statusResponse.status}`);
        continue;
      }

      const statusData = await statusResponse.json();
      console.log(`📊 Status: ${statusData.status || 'unknown'}`);
      console.log(`📋 Tasks count: ${Object.keys(statusData.tasks || {}).length}`);

      // Log all tasks and their details
      if (statusData.tasks) {
        Object.entries(statusData.tasks).forEach(([taskName, task]) => {
          console.log(`   Task "${taskName}": ${task.operation} - ${task.status}`);
          if (task.result) {
            console.log(`     Result:`, JSON.stringify(task.result, null, 2));
          }
          if (task.error) {
            console.log(`     Error:`, JSON.stringify(task.error, null, 2));
          }
        });
      }

      if (statusData.status === 'completed') {
        console.log('🎉 Job completed!');

        // Try the app's logic
        const exportTask = Object.values(statusData.tasks || {}).find((task) => task.name === 'export-1');
        console.log('🔍 App logic - exportTask:', exportTask ? 'found' : 'NOT FOUND');

        if (exportTask) {
          console.log('🔍 exportTask.result:', exportTask.result);
          console.log('🔍 exportTask.result?.url:', exportTask.result?.url);
          console.log('🔍 exportTask.result?.files:', exportTask.result?.files);

          if (exportTask.result?.url) {
            console.log('✅ App would find URL:', exportTask.result.url);
            return exportTask.result.url;
          } else if (exportTask.result?.files?.[0]?.url) {
            console.log('✅ App would find URL in files:', exportTask.result.files[0].url);
            return exportTask.result.files[0].url;
          } else {
            console.log('❌ App logic failed - no URL found in export task');
            console.log('Full exportTask:', JSON.stringify(exportTask, null, 2));
          }
        } else {
          console.log('❌ No export-1 task found');
        }

        // Try alternative logic
        const anyTaskWithUrl = Object.values(statusData.tasks || {}).find((task) =>
          task.result?.url || task.result?.files?.[0]?.url
        );
        if (anyTaskWithUrl) {
          const url = anyTaskWithUrl.result?.url || anyTaskWithUrl.result?.files?.[0]?.url;
          console.log('💡 Alternative logic found URL:', url);
        }

        return;
      }

      if (statusData.status === 'failed') {
        console.log('❌ Job failed:', JSON.stringify(statusData, null, 2));
        return;
      }
    }

    console.log('⏰ Timed out after 60 seconds');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testAppFreeConvert();
