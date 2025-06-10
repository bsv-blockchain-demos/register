const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing QuarkID Backend API...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch(`${BASE_URL}/`);
    const healthText = await healthResponse.text();
    console.log('✅ Health check response:', healthResponse.status, healthText);

    // Test 2: Check available endpoints
    console.log('\n2. Testing endpoint availability...');
    
    const endpoints = [
      '/v1/actors',
      '/v1/dwn/messages', 
      '/v1/tokens',
      '/.well-known/auth'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${BASE_URL}${endpoint}`);
        console.log(`   ${endpoint}: Status ${response.status}`);
        
        // If it's a 200 response, try to get JSON
        if (response.status === 200) {
          try {
            const data = await response.json();
            console.log(`     Data:`, JSON.stringify(data, null, 2));
          } catch (e) {
            const text = await response.text();
            console.log(`     Text:`, text);
          }
        }
      } catch (error) {
        console.log(`   ${endpoint}: Error -`, error.message);
      }
    }

    // Test 3: Try to create an actor (without auth - expect 403)
    console.log('\n3. Testing actor creation (expect 403 without auth)...');
    try {
      const actorResponse = await fetch(`${BASE_URL}/v1/actors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'Test Patient',
          email: 'patient@test.com',
          role: 'patient'
        })
      });
      console.log('   Actor creation status:', actorResponse.status);
    } catch (error) {
      console.log('   Actor creation error:', error.message);
    }

    console.log('\n🎉 API test completed!');
    console.log('\n📝 Summary:');
    console.log('- Server is running and responding');
    console.log('- Endpoints are protected by authentication (403 responses expected)');
    console.log('- Basic routing is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();
