import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/v1';

async function testSingleActorCreation() {
  console.log('Testing single actor creation with detailed output...\n');
  
  const actor = {
    name: 'Test Doctor',
    type: 'doctor',
    email: 'test.doctor@hospital.com'
  };
  
  try {
    console.log('Sending POST request to create actor...');
    const response = await fetch(`${API_URL}/actors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(actor)
    });
    
    const result = await response.json();
    console.log('\nFull API Response:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success && result.data) {
      console.log('\nActor created:');
      console.log(`- ID: ${result.data.id}`);
      console.log(`- DID: ${result.data.did || '[EMPTY]'}`);
      console.log(`- Name: ${result.data.name}`);
      console.log(`- Type: ${result.data.type}`);
      console.log(`- Public Key: ${result.data.publicKey}`);
    }
  } catch (error) {
    console.error('Error creating actor:', error);
  }
}

// Run the test
testSingleActorCreation().catch(console.error);
