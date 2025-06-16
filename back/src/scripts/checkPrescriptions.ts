import { MongoClient } from 'mongodb';
const DB_NAME = process.env.DB_NAME || "LARS_lookup_services";

async function checkPrescriptions() {
  const client = new MongoClient('mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    console.log('\n=== All Prescriptions ===');
    const prescriptions = await db.collection('prescriptions').find({}).toArray();
    
    prescriptions.forEach((p, index) => {
      console.log(`\nPrescription ${index + 1}:`);
      console.log('  ID:', p.credentialSubject?.prescription?.id);
      console.log('  Patient DID:', p.credentialSubject?.id);
      console.log('  Doctor DID:', p.issuer);
      console.log('  Medication:', p.credentialSubject?.prescription?.medication?.name);
      console.log('  Status:', p.credentialSubject?.prescription?.status);
      console.log('  Created:', p.createdAt);
    });
    
    console.log('\n=== Shared Prescriptions ===');
    const sharedPrescriptions = await db.collection('sharedPrescriptions').find({}).toArray();
    
    if (sharedPrescriptions.length === 0) {
      console.log('No shared prescriptions found');
    } else {
      sharedPrescriptions.forEach((sp, index) => {
        console.log(`\nShared Prescription ${index + 1}:`);
        console.log('  Prescription ID:', sp.prescriptionId);
        console.log('  Patient DID:', sp.patientDid);
        console.log('  Pharmacy DID:', sp.pharmacyDid);
        console.log('  Status:', sp.status);
        console.log('  Shared At:', sp.sharedAt);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkPrescriptions();
