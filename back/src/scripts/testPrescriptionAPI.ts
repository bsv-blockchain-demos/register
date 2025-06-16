import fetch, { RequestInit } from 'node-fetch';

async function testPrescriptionAPI() {
  const patientDid = 'did:bsv:quarkid-test:0611e00e153bd96a1e0739d82efff6a373dd1706fd40e803c99fce64c8b75c9b:1';
  const url = `http://localhost:3000/v1/prescriptions/actor/${encodeURIComponent(patientDid)}?role=patient`;
  
  console.log('Testing prescription API...');
  console.log('URL:', url);
  
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log('\nAPI Response:');
    console.log('Status:', response.status);
    console.log('Success:', data.success);
    console.log('Count:', data.count);
    console.log('\nPrescriptions:');
    
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach((p: any, index: number) => {
        console.log(`\n[${index + 1}] Prescription:`, {
          id: p.id,
          medication: p.credentialSubject?.prescription?.medication?.name,
          patientDid: p.credentialSubject?.id,
          status: p.credentialSubject?.prescription?.status
        });
      });
    }
  } catch (error) {
    console.error('Error calling API:', error.message);
  }
}

testPrescriptionAPI();
