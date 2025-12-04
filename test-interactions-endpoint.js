// Test script to verify interactions endpoint is working
const fetch = require('node-fetch');

const testEndpoint = async () => {
  const url = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/api/discord/interactions';
  
  console.log('Testing interactions endpoint...');
  
  try {
    // Test GET request
    const getResponse = await fetch(url);
    console.log('GET Response:', getResponse.status, await getResponse.text());
    
    // Test Discord verification challenge
    const verificationPayload = {
      type: 1 // PING type
    };
    
    const postResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(verificationPayload)
    });
    
    const result = await postResponse.json();
    console.log('POST Response:', postResponse.status, result);
    
    if (result.type === 1) {
      console.log('✅ Endpoint correctly handles Discord verification!');
    } else {
      console.log('❌ Endpoint not responding correctly to verification');
    }
    
  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
  }
};

testEndpoint();