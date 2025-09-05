import { PrivateKey, WalletClient, KeyDeriver } from '@bsv/sdk';
import { WalletStorageManager, Services, StorageClient, Wallet } from '@bsv/wallet-toolbox-client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables FIRST
const envPath = path.join(__dirname, '../../.env');
console.log('Loading .env from:', envPath);

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  process.exit(1);
}

dotenv.config({ path: envPath });

async function checkWallet() {
  try {
    console.log('🔍 Checking wallet configuration and balance...\n');
    
    const platformKey = process.env.PLATFORM_FUNDING_KEY;
    const walletStorageUrl = process.env.WALLET_STORAGE_URL || 'https://storage.babbage.systems';
    
    if (!platformKey) {
      console.error('❌ PLATFORM_FUNDING_KEY not found in environment');
      process.exit(1);
    }
    
    const rootKey = PrivateKey.fromHex(platformKey);
    console.log('Root key (first 16 chars):', platformKey.substring(0, 16) + '...');
    
    const keyDeriver = new KeyDeriver(rootKey);
    console.log('\nDerived keys:');
    console.log('- Identity key:', keyDeriver.identityKey);
    console.log('- Root key object:', !!keyDeriver.rootKey);
    
    // Create wallet same way as app
    const storage = new WalletStorageManager(keyDeriver.identityKey);
    const chain = 'main';
    const services = new Services(chain);
    const wallet = new Wallet({
      chain,
      keyDeriver,
      storage,
      services,
    });
    
    console.log('\nWallet configuration:');
    console.log('- Chain:', chain);
    console.log('- Storage URL:', walletStorageUrl);
    console.log('- Identity:', wallet.identityKey);
    console.log('- User party:', wallet.userParty);
    
    const client = new StorageClient(wallet, walletStorageUrl);
    await storage.addWalletStorageProvider(client);
    await storage.makeAvailable();
    
    const walletClient = new WalletClient(wallet);
    
    // Try to create a simple transaction
    console.log('\n💰 Testing transaction creation (1 sat OP_RETURN)...');
    try {
      const testResult = await walletClient.createAction({
        description: 'Test transaction',
        outputs: [{
          satoshis: 1,
          lockingScript: '006a' // Simple OP_RETURN
        }],
        options: {
          randomizeOutputs: false
        }
      });
      console.log('✅ Transaction creation successful!');
      console.log('Transaction ID:', testResult.txid);
    } catch (error: any) {
      console.log('❌ Transaction creation failed:', error.message);
      if (error.data) {
        console.log('Error details:', JSON.stringify(error.data, null, 2));
      }
    }
    
    console.log('\n💡 Key findings:');
    console.log('1. The wallet uses a DERIVED identity key, not the root key directly');
    console.log('2. Funds need to be on the address controlled by the identity key');
    console.log('3. Identity used by storage:', keyDeriver.identityKey);
    
    console.log('\n📝 To fix this issue:');
    console.log('1. The funds (29,993 sats) are likely on the root key address');
    console.log('2. But the wallet storage is looking for funds on a derived address');
    console.log('3. You may need to transfer funds to the correct derived address');
    console.log('4. Or use a different wallet initialization method');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWallet().catch(console.error);