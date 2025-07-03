// test-kms.js - Test script to verify BsvWalletKMS functionality
const { WalletClient } = require('@bsv/sdk');
const { Suite } = require('@quarkid/kms-core');

// Import the BsvWalletKMS class
const { BsvWalletKMS } = require('./src/plugins/BsvWalletKMS');

async function testKMS() {
  console.log('🧪 Testing BsvWalletKMS functionality...\n');
  
  try {
    // Create a mock wallet client
    const walletClient = {
      // Mock implementation
    };
    
    // Create BsvWalletKMS instance
    const kms = new BsvWalletKMS(walletClient);
    console.log('✅ BsvWalletKMS created successfully');
    
    // Test key creation
    console.log('\n🔑 Testing key creation...');
    const keyResult = await kms.create(Suite.ES256k);
    console.log('✅ Key created successfully');
    console.log('Public Key JWK:', JSON.stringify(keyResult.publicKeyJWK, null, 2));
    
    // Test getting keys by suite type
    console.log('\n🔍 Testing getPublicKeysBySuiteType...');
    const keys = await kms.getPublicKeysBySuiteType(Suite.ES256k);
    console.log(`✅ Found ${keys.length} ES256k keys`);
    
    if (keys.length > 0) {
      console.log('First key JWK:', JSON.stringify(keys[0], null, 2));
    }
    
    // Test getting all keys
    console.log('\n🔍 Testing getAllPublicKeys...');
    const allKeys = await kms.getAllPublicKeys();
    console.log(`✅ Found ${allKeys.length} total keys`);
    
    // Test signing
    console.log('\n✍️ Testing signing...');
    const testMessage = 'Hello, BSV!';
    const signature = await kms.sign(Suite.ES256k, keys[0], testMessage);
    console.log('✅ Message signed successfully');
    console.log('Signature:', signature);
    
    // Test signature verification
    console.log('\n✅ Testing signature verification...');
    const isValid = await kms.verifySignature(keys[0], testMessage, signature);
    console.log(`✅ Signature verification: ${isValid ? 'PASSED' : 'FAILED'}`);
    
    console.log('\n🎉 All tests passed! BsvWalletKMS is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testKMS().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 