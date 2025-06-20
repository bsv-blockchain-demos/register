#!/usr/bin/env node
import fetch from 'node-fetch';

const API_URL = 'http://localhost:3000/v1';

async function testDIDCreation() {
    console.log('Testing DID creation and LARS submission...\n');
    
    // Create a test actor
    const actorData = {
        name: `Test Actor ${Date.now()}`,
        type: 'doctor' as const,
        email: `test${Date.now()}@example.com`,
        licenseNumber: `LIC${Date.now()}`
    };
    
    console.log('Creating actor:', actorData);
    
    try {
        const response = await fetch(`${API_URL}/actors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(actorData),
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            console.error('❌ Failed to create actor:', result);
            return;
        }
        
        // Extract actor data from nested response
        const actorDataResponse = result.data || result;
        
        console.log('✅ Actor created successfully!');
        console.log('Actor ID:', actorDataResponse.id);
        console.log('Actor DID:', actorDataResponse.did);
        
        if (!actorDataResponse.did) {
            console.error('❌ No DID returned for actor');
            return;
        }
        
        // Wait a moment for LARS to process
        console.log('\nWaiting 2 seconds for LARS to process...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to resolve the DID
        console.log('\nAttempting to resolve DID:', actorDataResponse.did);
        const resolveResponse = await fetch(`${API_URL}/dids/${encodeURIComponent(actorDataResponse.did)}`);
        const resolveResult = await resolveResponse.json();
        
        if (!resolveResponse.ok) {
            console.error('❌ Failed to resolve DID:', resolveResult);
        } else {
            console.log('✅ DID resolved successfully!');
            console.log('DID Document:', JSON.stringify(resolveResult, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

// Run the test
testDIDCreation();
