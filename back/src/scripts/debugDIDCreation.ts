import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000/v1';

async function debugDIDCreation() {
  console.log('\n=== DEBUG DID CREATION TEST ===\n');
  
  try {
    // Create a single test actor to trace DID creation
    console.log('1. Creating test doctor actor...');
    const timestamp = Date.now();
    const doctorData = {
      name: `Debug Doctor ${timestamp}`,
      type: 'doctor',
      specialization: 'debug',
      licenseNumber: `DEBUG-${timestamp}`
    };
    
    console.log('   Sending POST request to /v1/actors...');
    const doctorResponse = await axios.post(`${API_BASE_URL}/actors`, doctorData);
    
    console.log('\n2. Doctor actor created:');
    console.log('   Response status:', doctorResponse.status);
    console.log('   Response data:', JSON.stringify(doctorResponse.data, null, 2));
    
    const doctorDid = doctorResponse.data.data.did;
    console.log('\n3. Doctor DID:', doctorDid);
    
    // Now try to resolve the DID
    console.log('\n4. Attempting to resolve the created DID...');
    try {
      const resolveResponse = await axios.get(`${API_BASE_URL}/did/resolve/${encodeURIComponent(doctorDid)}`);
      console.log('   Resolution response:', JSON.stringify(resolveResponse.data, null, 2));
    } catch (resolveError: any) {
      console.log('   Resolution failed:', resolveError.response?.data || resolveError.message);
    }
    
  } catch (error: any) {
    console.error('\nError during test:', error.response?.data || error.message);
    console.error('Full error:', error);
  }
}

// Run the test
debugDIDCreation()
  .then(() => {
    console.log('\n=== TEST COMPLETE ===\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
