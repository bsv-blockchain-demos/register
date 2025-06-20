import axios from 'axios';

const API_URL = 'http://localhost:8080/v1';

async function testPatientCreation() {
  try {
    console.log('1. Checking existing patients...');
    const actorsResponse = await axios.get(`${API_URL}/actors?type=patient`);
    console.log(`Found ${actorsResponse.data.data?.length || 0} patients`);
    
    if (actorsResponse.data.data?.length > 0) {
      console.log('Existing patients:');
      actorsResponse.data.data.forEach((patient: any) => {
        console.log(`  - ${patient.name} (DID: ${patient.did || 'NO DID'})`);
      });
    }

    console.log('\n2. Creating new test patient...');
    const newPatient = {
      name: 'Test Patient ' + Date.now(),
      type: 'patient',
      email: 'testpatient@example.com',
      phone: '555-0123',
      address: '123 Test St',
      insuranceProvider: 'Test Insurance Co'
    };

    const createResponse = await axios.post(`${API_URL}/actors`, newPatient);
    console.log('Patient creation response:', JSON.stringify(createResponse.data, null, 2));

    if (createResponse.data.success && createResponse.data.data?.did) {
      console.log(`✅ Patient created successfully with DID: ${createResponse.data.data.did}`);
    } else {
      console.log('❌ Patient created but NO DID assigned');
    }

    // Check if the patient appears in the list now
    console.log('\n3. Verifying patient in list...');
    const verifyResponse = await axios.get(`${API_URL}/actors?type=patient`);
    const newPatientInList = verifyResponse.data.data?.find((p: any) => 
      p.name === newPatient.name
    );
    
    if (newPatientInList) {
      console.log(`Found new patient in list with DID: ${newPatientInList.did || 'NO DID'}`);
    } else {
      console.log('New patient not found in list');
    }

  } catch (error: any) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testPatientCreation();
