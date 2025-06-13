import fetch from 'node-fetch';

async function testActorEndpoint() {
  try {
    console.log('Testing /v1/actors endpoint...');
    
    const response = await fetch('http://localhost:3000/v1/actors', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', response.headers.raw());
    
    const text = await response.text();
    console.log('Raw response text:', text);
    console.log('Response text length:', text.length);
    console.log('Response text type:', typeof text);
    
    if (text === 'null') {
      console.log('⚠️  Response is the literal string "null"');
    }
    
    try {
      const json = JSON.parse(text);
      console.log('Parsed JSON:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('Failed to parse as JSON:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testActorEndpoint();
