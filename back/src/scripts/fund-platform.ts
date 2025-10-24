/**
 * fund-platform.ts
 *
 * Funds the platform BSV key using BRC-100 compliant wallet-toolbox.
 * Creates a funded wallet from the PLATFORM_FUNDING_KEY and derives its address.
 * This wallet can then receive funds and be used by the platform.
 *
 * Usage: npx tsx src/scripts/fund-platform.ts
 *
 * Prerequisites:
 * - Platform keys generated (run generate-keys.ts first)
 * - PLATFORM_FUNDING_KEY set in .env
 */

import { PrivateKey, WalletClient, KeyDeriver } from '@bsv/sdk';
import { WalletStorageManager, Services, StorageClient, Wallet } from '@bsv/wallet-toolbox-client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Loads platform private key from .env file
 */
function loadPlatformKey(): PrivateKey {
  const envPath = path.join(__dirname, '../../.env');

  if (!fs.existsSync(envPath)) {
    throw new Error(
      '.env file not found. Please run:\n' +
      '  npx tsx src/scripts/generate-keys.ts\n' +
      'to generate platform keys first.'
    );
  }

  // Load environment variables (only if not already loaded)
  if (!process.env.PLATFORM_FUNDING_KEY) {
    dotenv.config({ path: envPath });
  }

  const platformKeyHex = process.env.PLATFORM_FUNDING_KEY;

  if (!platformKeyHex || platformKeyHex === 'your_platform_funding_key_here') {
    throw new Error(
      'PLATFORM_FUNDING_KEY not found or not set in .env file.\n' +
      'Please run: npx tsx src/scripts/generate-keys.ts'
    );
  }

  // Validate key format (must be 64 hex chars)
  if (!/^[0-9a-fA-F]{64}$/.test(platformKeyHex)) {
    throw new Error(
      `PLATFORM_FUNDING_KEY is invalid (must be 64 hex characters).\n` +
      `Current value: ${platformKeyHex.substring(0, 16)}... (${platformKeyHex.length} chars)\n` +
      'Please run: npx tsx src/scripts/generate-keys.ts'
    );
  }

  return PrivateKey.fromHex(platformKeyHex);
}

/**
 * Creates a BRC-100 compliant wallet from the platform funding key
 */
async function createPlatformWallet(privateKey: PrivateKey, storageUrl: string): Promise<{ wallet: Wallet; walletClient: WalletClient }> {
  const keyDeriver = new KeyDeriver(privateKey);
  const storage = new WalletStorageManager(keyDeriver.identityKey);
  const chain = 'main';
  const services = new Services(chain);

  const wallet = new Wallet({
    chain,
    keyDeriver,
    storage,
    services,
  });

  // Add storage provider for syncing wallet state
  const client = new StorageClient(wallet, storageUrl);
  await storage.addWalletStorageProvider(client);
  await storage.makeAvailable();

  return {
    wallet,
    walletClient: new WalletClient(wallet)
  };
}

async function fundPlatform(): Promise<void> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('💰 SETTING UP BRC-100 COMPLIANT PLATFORM WALLET');
    console.log('='.repeat(80) + '\n');

    // Load wallet storage URL from environment
    const storageUrl = process.env.WALLET_STORAGE_URL || 'https://storage.babbage.systems';
    console.log(`📡 Wallet Storage URL: ${storageUrl}\n`);

    // Load platform private key
    console.log('🔑 Loading platform key from .env...');
    const platformKey = loadPlatformKey();
    const platformPublicKey = platformKey.toPublicKey();
    const platformAddress = platformPublicKey.toAddress();

    console.log('   ✓ Platform key loaded successfully');
    console.log(`   Private Key: ${platformKey.toHex().substring(0, 16)}...${platformKey.toHex().substring(48, 64)}`);
    console.log(`   Public Key:  ${platformPublicKey.toString().substring(0, 32)}...`);
    console.log(`   Address:     ${platformAddress}\n`);

    // Create BRC-100 wallet with storage provider
    console.log('🔨 Creating BRC-100 compliant wallet from platform key...');
    const { wallet, walletClient } = await createPlatformWallet(platformKey, storageUrl);
    console.log('   ✓ Wallet created successfully');
    console.log('   ✓ Connected to wallet storage provider\n');

    // Get wallet balance
    console.log('💵 Checking wallet balance...');
    try {
      const balance = await wallet.balance();
      console.log(`   Current Balance: ${balance.toLocaleString()} satoshis (${(balance / 100_000_000).toFixed(8)} BSV)\n`);

      if (balance > 0) {
        console.log('✅ WALLET IS ALREADY FUNDED!\n');
      } else {
        console.log('⚠️  WALLET HAS ZERO BALANCE\n');
      }
    } catch (balanceError) {
      console.log('   ⚠️  Could not check balance (wallet may not be synced yet)\n');
    }

    console.log('='.repeat(80));
    console.log('✅ BRC-100 WALLET SETUP COMPLETE');
    console.log('='.repeat(80) + '\n');

    console.log('📋 Wallet Details:');
    console.log(`   Type:        BRC-100 Compliant Wallet`);
    console.log(`   Chain:       mainnet`);
    console.log(`   Address:     ${platformAddress}`);

    console.log('\n💡 How to Fund This Wallet:');
    console.log('   You can fund this wallet using any of these methods:\n');

    console.log('   1. SEND BSV DIRECTLY TO THE ADDRESS:');
    console.log(`      Address: ${platformAddress}`);
    console.log('      Use any BSV wallet to send funds to this address\n');

    console.log('   2. USE A FAUCET (for testing):');
    console.log('      • Mainnet: https://faucet.bitcoinscaling.io');
    console.log('      • Testnet: https://faucet.satoshisvision.network\n');

    console.log('   3. BUY BSV:');
    console.log('      • https://coinbase.com (supports BSV)');
    console.log('      • https://kraken.com');
    console.log('      • Then withdraw to the address above\n');

    console.log('📍 Block Explorer:');
    console.log(`   Check balance and transactions at:`);
    console.log(`   https://whatsonchain.com/address/${platformAddress}\n`);

    console.log('🔄 After Funding:');
    console.log('   • Re-run this script to check balance');
    console.log('   • Start the backend server to use the funded wallet');
    console.log('   • The platform will automatically use this wallet for operations\n');

    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      if (error.message.includes('PLATFORM_FUNDING_KEY')) {
        console.error('\n💡 Key Issue:');
        console.error('   • The PLATFORM_FUNDING_KEY is missing or invalid');
        console.error('   • Run: npx tsx src/scripts/generate-keys.ts');
        console.error('   • This will generate valid keys and save them to .env');
      }

      if (error.stack) {
        console.error('\n📋 Stack Trace:');
        console.error(error.stack);
      }
    }

    console.error('\n' + '='.repeat(80) + '\n');
    process.exit(1);
  }
}

// Run the function
if (require.main === module) {
  fundPlatform().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { fundPlatform };
