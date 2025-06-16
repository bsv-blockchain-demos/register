import fetch, { RequestInit } from 'node-fetch';

async function testSharePrescription() {
  // Use actual prescription ID from the database
  const prescriptionId = '04cf95cd-3d78-46b0-a1a2-e22d2a5215d2';
  const patientDid = 'did:bsv:quarkid-test:0611e00e153bd96a1e0739d82efff6a373dd1706fd40e803c99fce64c8b75c9b:1';
  const pharmacyDid = 'did:bsv:quarkid-test:96cf2077a50c5bb1f5d7c436c6f4ad7e5d09e56a29b02a77d31e49de87ede61f:1';
  
  const url = 'http://localhost:3000/v1/prescriptions/share';
  
  console.log('Testing prescription sharing...');
  console.log('Prescription ID:', prescriptionId);
  console.log('Patient DID:', patientDid);
  console.log('Pharmacy DID:', pharmacyDid);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prescriptionId,
        patientDid,
        pharmacyDid
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('\nAPI Response:');
    console.log('Status:', response.status);
    console.log('Success:', data.success);
    
    if (data.success) {
      console.log('Share Details:', {
        prescriptionId: data.data?.prescriptionId,
        sharedWith: data.data?.sharedWith,
        sharedAt: data.data?.sharedAt
      });
    } else {
      console.log('Error:', data.error);
      console.log('Details:', data.details);
    }
  } catch (error) {
    console.error('Error calling API:', error.message);
  }
}

testSharePrescription();
