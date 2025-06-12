import axios from 'axios';

const API_URL = 'http://localhost:3000';

interface Actor {
  name: string;
  type: 'patient' | 'doctor' | 'pharmacy' | 'insurance';
  email: string;
}

const testActors: Actor[] = [
  { name: 'Dr. Smith', type: 'doctor', email: 'dr.smith@hospital.com' },
  { name: 'John Doe', type: 'patient', email: 'john.doe@email.com' },
  { name: 'City Pharmacy', type: 'pharmacy', email: 'info@citypharmacy.com' },
  { name: 'Health Insurance Co', type: 'insurance', email: 'claims@healthins.com' }
];

async function createDID(actor: Actor) {
  try {
    console.log(`\n📝 Creating DID for ${actor.name} (${actor.type})...`);
    
    const response = await axios.post(`${API_URL}/v1/actors`, {
      name: actor.name,
      type: actor.type,
      email: actor.email,
      active: true
    });
    
    const result = await response.data;
    console.log(`   Full Response:`, JSON.stringify(result, null, 2));
    
    const actorData = result.data || result;
    
    if (actorData.did) {
      console.log(`✅ DID created successfully!`);
      console.log(`   DID: ${actorData.did}`);
      console.log(`   Actor ID: ${actorData.id}`);
      console.log(`   Public Key: ${actorData.publicKey?.substring(0, 20)}...`);
      return actorData;
    } else {
      console.log(`❌ Failed to create DID for ${actor.name}`);
      console.log(`   Response:`, actorData);
      return null;
    }
  } catch (error: any) {
    console.error(`❌ Failed to create DID for ${actor.name}:`, error.response?.data || error.message);
    return null;
  }
}

async function lookupDID(did: string) {
  try {
    console.log(`\n🔍 Looking up DID: ${did}`);
    
    // Encode the DID for the URL
    const encodedDid = encodeURIComponent(did);
    const response = await axios.get(`${API_URL}/v1/actors/did/${encodedDid}`);
    
    console.log(`   Full Response:`, JSON.stringify(response.data, null, 2));
    
    const actorData = response.data.data || response.data; // Handle both structures
    
    console.log(`✅ DID resolved successfully!`);
    console.log(`   Actor: ${actorData.name} (${actorData.type})`);
    console.log(`   DID: ${actorData.did}`);
    console.log(`   Status: ${actorData.active ? 'Active' : 'Inactive'}`);
    
    return actorData;
  } catch (error: any) {
    console.error(`❌ Failed to lookup DID:`, error.response?.data || error.message);
    return null;
  }
}

async function testDidWorkflow() {
  console.log('🚀 Starting DID Creation Test for Prescription System\n');
  console.log('=' .repeat(60));
  
  const createdActors = [];
  
  // Create DIDs for all actors
  for (const actor of testActors) {
    const result = await createDID(actor);
    if (result) {
      createdActors.push(result);
    }
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between creations
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Summary: Created ' + createdActors.length + ' DIDs\n');
  
  // Test DID lookup for created actors
  if (createdActors.length > 0) {
    console.log('Testing DID Lookup...');
    console.log('=' .repeat(60));
    
    for (const actor of createdActors) {
      if (actor.did) {
        await lookupDID(actor.did);
      }
    }
  }
  
  // Simulate doctor verifying patient's DID (QR code scenario)
  const doctor = createdActors.find(a => a.type === 'doctor');
  const patient = createdActors.find(a => a.type === 'patient');
  
  if (doctor && patient) {
    console.log('\n' + '=' .repeat(60));
    console.log('🏥 Simulating Doctor Verifying Patient QR Code');
    console.log(`   Doctor: ${doctor.name} (${doctor.did})`);
    console.log(`   Patient: ${patient.name} (${patient.did})`);
    
    // In real scenario, patient shows QR code containing their DID
    // Doctor scans and verifies through QuarkID APIProxy
    const patientLookup = await lookupDID(patient.did);
    if (patientLookup) {
      console.log('✅ Patient identity verified successfully!');
    }
  }
  
  console.log('\n✨ DID Creation Test Complete!\n');
}

// Run the test
testDidWorkflow().catch(console.error);
