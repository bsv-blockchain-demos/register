import { PrivateKey, KeyDeriver, WalletStorageManager, Services, StorageClient, Wallet, WalletClient } from '@bsv/wallet-toolbox-client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { appConfig } from '../config/AppConfig';

async function checkWallet() {
  try {
    console.log('🔍 Checking wallet configuration and balance...\n');
    
    const rootKey = PrivateKey.fromHex(appConfig.platformFundingKey);
    console.log('Root key (first 16 chars):', appConfig.platformFundingKey.substring(0, 16) + '...');
    
    const keyDeriver = new KeyDeriver(rootKey);
    console.log('Identity key:', keyDeriver.identityKey);
    console.log('Root public key:', rootKey.toPublicKey().toString());
    
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
    console.log('- Storage URL:', appConfig.walletStorageUrl);
    console.log('- Identity:', wallet.identityKey);
    
    const client = new StorageClient(wallet, appConfig.walletStorageUrl);
    await storage.addWalletStorageProvider(client);
    await storage.makeAvailable();
    
    const walletClient = new WalletClient(wallet);
    
    // Try to get balance or any wallet info
    console.log('\n📊 Wallet status:');
    console.log('- User party:', wallet.userParty);
    console.log('- Trust self:', wallet.trustSelf);
    
    // Check if we can create a simple transaction
    console.log('\n💰 Testing transaction creation...');
    try {
      const testResult = await walletClient.createAction({
        description: 'Test transaction',
        outputs: [{
          satoshis: 1,
          lockingScript: '006a' // Simple OP_RETURN
        }]
      });
      console.log('✅ Transaction creation successful!');
      console.log('Transaction ID:', testResult.txid);
    } catch (error: any) {
      console.log('❌ Transaction creation failed:', error.message);
      if (error.data) {
        console.log('Error data:', JSON.stringify(error.data, null, 2));
      }
    }
    
    console.log('\n💡 Suggestions:');
    console.log('1. Verify the private key has funds at the ROOT address, not a derived address');
    console.log('2. The identity key used by storage service is:', keyDeriver.identityKey);
    console.log('3. Make sure funds are on the address for the ROOT private key');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWallet().catch(console.error);