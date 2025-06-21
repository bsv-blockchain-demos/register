import fetch from 'node-fetch';

interface TestActor {
  name: string;
  type: string;
  email: string;
  phone?: string;
  address?: string;
  licenseNumber?: string;
  specialization?: string;
  insuranceProvider?: string;
}

const testActors: TestActor[] = [
  {
    name: 'Dr. Emily Johnson',
    type: 'doctor',
    email: 'emily.johnson@healthcenter.com',
    phone: '+1-555-0101',
    address: '123 Medical Plaza, Suite 200 Mountainstrasse, Zug, Switzerland 94102',
    licenseNumber: 'CA-MD-2024001',
    specialization: 'General Practice'
  },
  {
    name: 'John Smith',
    type: 'patient',
    email: 'john.smith@email.com',
    phone: '+1-555-0102',
    address: '456 Oak Street, Apt 3B Lakenstrasse, Zug, Switzerland 94103'
  },
  {
    name: 'MediCare Pharmacy',
    type: 'pharmacy',
    email: 'contact@medicarepharmacy.com',
    phone: '+1-555-0103',
    address: '789 Market Street TownMeetenstrasse, Zug, Switzerland 94104',
    licenseNumber: 'CA-PH-2024002'
  },
  {
    name: 'HealthFirst Insurance',
    type: 'insurance',
    email: 'claims@healthfirst.com',
    phone: '+1-555-0104',
    address: '321 Insurance Blvd Safenstrasse, Zug, Switzerland 94105',
    insuranceProvider: 'HealthFirst Insurance Group'
  }
];

async function seedActors() {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
  
  console.log('🌱 Starting actor seeding process...\n');
  
  for (const actor of testActors) {
    try {
      console.log(`Creating ${actor.type}: ${actor.name}...`);
      
      const response = await fetch(`${API_BASE_URL}/v1/actors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(actor)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to create ${actor.type}: ${response.status} - ${errorText}`);
        continue;
      }
      
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log(`✅ Created ${actor.type}: ${actor.name}`);
        console.log(`   ID: ${result.data.id}`);
        console.log(`   DID: ${result.data.did || 'No DID created'}`);
        console.log(`   Email: ${result.data.email}`);
      } else {
        console.error(`❌ Unexpected response for ${actor.type}:`, result);
      }
      
    } catch (error) {
      console.error(`❌ Error creating ${actor.type}:`, error);
    }
    
    console.log(''); // Empty line for readability
  }
  
  console.log('🎉 Actor seeding complete!\n');
  
  // Fetch and display all actors
  try {
    console.log('📋 Fetching all actors...');
    const response = await fetch(`${API_BASE_URL}/v1/actors`);
    const result = await response.json();
    
    if (result.success && result.data) {
      console.log(`\nTotal actors in database: ${result.count || result.data.length}\n`);
      
      const actorsByType = result.data.reduce((acc: any, actor: any) => {
        acc[actor.type] = acc[actor.type] || [];
        acc[actor.type].push(actor.name);
        return acc;
      }, {});
      
      Object.entries(actorsByType).forEach(([type, names]) => {
        console.log(`${type.charAt(0).toUpperCase() + type.slice(1)}s:`);
        (names as string[]).forEach(name => console.log(`  - ${name}`));
      });
    }
  } catch (error) {
    console.error('Error fetching actors:', error);
  }
}

// Run the seeding script
seedActors().catch(console.error);
