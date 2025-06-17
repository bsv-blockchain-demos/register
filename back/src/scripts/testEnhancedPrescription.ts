import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/v1';

async function testEnhancedPrescriptionCreation() {
  try {
    // Create new actors for this test run
    console.log('Creating new test actors...');
    
    // Create a new doctor
    const doctorResponse = await fetch(`${API_URL}/actors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Dr. Test ${Date.now()}`,
        type: 'doctor',
        email: `doctor${Date.now()}@test.com`,
        licenseNumber: `LIC${Date.now()}`
      })
    });
    
    const doctorResult = await doctorResponse.json();
    if (!doctorResponse.ok || !doctorResult.success) {
      console.error('Failed to create doctor:', doctorResult.error || 'Unknown error');
      return;
    }
    
    const doctor = doctorResult.data;
    console.log('✅ Created doctor:', doctor.name, 'DID:', doctor.did);
    
    // Create a new patient
    const patientResponse = await fetch(`${API_URL}/actors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Patient Test ${Date.now()}`,
        type: 'patient',
        email: `patient${Date.now()}@test.com`,
        dateOfBirth: '1990-01-01',
        insuranceProvider: 'TestInsurance'
      })
    });
    
    const patientResult = await patientResponse.json();
    if (!patientResponse.ok || !patientResult.success) {
      console.error('Failed to create patient:', patientResult.error || 'Unknown error');
      return;
    }
    
    const patient = patientResult.data;
    console.log('✅ Created patient:', patient.name, 'DID:', patient.did);
    
    // Create enhanced prescription
    const prescriptionData = {
      doctorDid: doctor.did,
      patientDid: patient.did,
      medicationName: 'Amoxicillin',
      dosage: '500mg',
      quantity: '21',
      instructions: 'Take with food. Complete the full course even if symptoms improve. Three times daily for 7 days.',
      diagnosisCode: 'J00',
      insuranceDid: patient.insuranceProvider || undefined,
      expiryHours: '720'
    };
    
    console.log('\nCreating enhanced prescription with BSV token...');
    const createResponse = await fetch(`${API_URL}/enhanced/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prescriptionData)
    });

    const createResult = await createResponse.json();
    
    if (!createResponse.ok || !createResult.success) {
      console.error('❌ Failed to create prescription:', createResult.error || createResult.message || 'Unknown error');
      console.error('Full response:', JSON.stringify(createResult, null, 2));
      return;
    }
    
    console.log('\n✅ Enhanced prescription created successfully!');
    console.log('Prescription ID:', createResult.prescriptionId);
    console.log('Token ID:', createResult.tokenId);
    console.log('Transaction ID:', createResult.txid);
    console.log('Status:', createResult.status);
    
    // Test fetching prescriptions by doctor
    console.log('\nFetching prescriptions by doctor...');
    const fetchResponse = await fetch(`${API_URL}/enhanced/prescriptions/doctor/${doctor.did}`);
    const prescriptions = await fetchResponse.json();
    
    console.log(`Found ${prescriptions.length} prescription(s) for doctor`);
    if (prescriptions.length > 0) {
      console.log('Latest prescription:', prescriptions[0]);
    }
    
  } catch (error) {
    console.error('Error testing enhanced prescription:', error);
  }
}

// Run the test
testEnhancedPrescriptionCreation();
