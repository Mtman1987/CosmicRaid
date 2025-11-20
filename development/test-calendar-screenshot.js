const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testCalendarScreenshot() {
  const localServiceUrl = 'https://unostensible-carola-preallied.ngrok-free.dev';
  const calendarUrl = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/calendar';
  
  console.log('📸 Testing calendar screenshot...');
  console.log('Local service:', localServiceUrl);
  console.log('Calendar URL:', calendarUrl);
  
  try {
    const response = await fetch(`${localServiceUrl}/api/screenshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: calendarUrl,
        width: 1200,
        height: 800,
        selector: '.calendar-container',
        waitFor: 2000
      })
    });
    
    if (!response.ok) {
      throw new Error(`Screenshot failed: ${response.status} ${await response.text()}`);
    }
    
    const result = await response.json();
    console.log('✅ Screenshot successful!');
    console.log('Result:', result);
    
    if (result.imageUrl) {
      console.log('🖼️ Image URL:', result.imageUrl);
    }
    
  } catch (error) {
    console.error('❌ Screenshot failed:', error.message);
  }
}

testCalendarScreenshot();