#!/usr/bin/env node
import { MongoClient, Db } from 'mongodb';
import fetch from 'node-fetch';
import { DIDStorageManager } from '../../../overlay/backend/src/DIDStorageManager';
import DIDLookupServiceFactory from '../../../overlay/backend/src/DIDLookupServiceFactory';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const API_URL = 'http://localhost:3000/v1';

async function testDirectDIDCreation() {
    console.log('Testing DID creation via API and resolution via DID Lookup Service...\n');
    
    let mongoClient: MongoClient | null = null;
    
    try {
        // 1. Set up MongoDB connection
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
        const dbName = process.env.MONGODB_DB || 'quarkid-bsv';
        
        console.log('Connecting to MongoDB...');
        mongoClient = new MongoClient(mongoUri);
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        console.log('MongoDB connected successfully');
        
        // 2. Create DID via HTTP API
        console.log('\nCreating DID via /v1/dids/create...');
        const createResponse = await fetch(`${API_URL}/dids/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: 'Test DID'
            }),
        });
        
        const createResult = await createResponse.json();
        console.log('Create response:', JSON.stringify(createResult, null, 2));
        
        if (!createResponse.ok || !createResult.data?.did) {
            throw new Error(`Failed to create DID: ${createResult.description || 'Unknown error'}`);
        }
        
        const did = createResult.data.did;
        console.log(`\nDID created successfully: ${did}`);
        
        // Extract serialNumber from DID (format: did:bsv:tm_did:serialNumber)
        const didParts = did.split(':');
        if (didParts.length !== 4 || didParts[0] !== 'did' || didParts[1] !== 'bsv') {
            throw new Error(`Invalid DID format: ${did}`);
        }
        const serialNumber = didParts[3];
        console.log(`Extracted serialNumber: ${serialNumber}`);
        
        // 3. Wait a bit for any async operations
        console.log('\nWaiting 2 seconds for data propagation...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 4. Create DID Lookup Service instance
        console.log('\nCreating DID Lookup Service instance...');
        const lookupService = DIDLookupServiceFactory(db);
        
        // 5. Query using serialNumber
        console.log(`\nQuerying DID Lookup Service with serialNumber: ${serialNumber}`);
        const lookupQuestion = {
            service: 'ls_did',
            query: {
                serialNumber: serialNumber
            }
        };
        
        const lookupResult = await lookupService.lookup(lookupQuestion);
        console.log('Lookup result:', JSON.stringify(lookupResult, null, 2));
        
        // 6. Also try querying by outpoint if we have the transaction info
        if (createResult.data.txid && createResult.data.vout !== undefined) {
            const outpoint = `${createResult.data.txid}.${createResult.data.vout}`;
            console.log(`\nQuerying DID Lookup Service with outpoint: ${outpoint}`);
            const outpointQuestion = {
                service: 'ls_did',
                query: {
                    outpoint: outpoint
                }
            };
            
            const outpointResult = await lookupService.lookup(outpointQuestion);
            console.log('Outpoint lookup result:', JSON.stringify(outpointResult, null, 2));
        }
        
        console.log('\n✅ DID creation and lookup test completed!');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
    } finally {
        // Clean up MongoDB connection
        if (mongoClient) {
            await mongoClient.close();
            console.log('\nMongoDB connection closed');
        }
    }
}

// Run the test
testDirectDIDCreation().catch(console.error);
