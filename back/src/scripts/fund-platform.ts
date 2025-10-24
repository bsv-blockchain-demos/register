/**
 * fund-platform.ts
 *
 * Funds the platform BSV key using BRC-100 compliant wallet-toolbox.
 * Creates a funded wallet from the PLATFORM_FUNDING_KEY and can optionally
 * fund it by connecting to an external BRC-100 wallet (e.g., Metanet Desktop Wallet).
 *
 * Usage:
 *   npx tsx src/scripts/fund-platform.ts              # Check balance and show funding options
 *   npx tsx src/scripts/fund-platform.ts --fund       # Fund from external BRC-100 wallet
 *   npx tsx src/scripts/fund-platform.ts --fund 50000 # Fund specific amount from external wallet
 *
 * Prerequisites:
 * - Platform keys generated (run generate-keys.ts first)
 * - PLATFORM_FUNDING_KEY set in .env
 * - For --fund option: External BRC-100 wallet running (e.g., Metanet Desktop Wallet)
 */

import { PrivateKey, WalletClient, KeyDeriver, P2PKH } from '@bsv/sdk';
import { WalletStorageManager, Services, StorageClient, Wallet } from '@bsv/wallet-toolbox-client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Default funding amount in satoshis (0.01 BSV = 1,000,000 satoshis)
 */
const DEFAULT_FUNDING_AMOUNT = 0.01 * 1_000_000;

/**
 * Checks if platform key exists and is valid in .env file
 */
function checkPlatformKeyExists(): { exists: boolean; valid: boolean; key?: string } {
  const envPath = path.join(__dirname, '../../.env');

  if (!fs.existsSync(envPath)) {
    return { exists: false, valid: false };
  }

  // Load environment variables (only if not already loaded)
  if (!process.env.PLATFORM_FUNDING_KEY) {
    dotenv.config({ path: envPath });
  }

  const platformKeyHex = process.env.PLATFORM_FUNDING_KEY;

  // Check if key exists
  if (!platformKeyHex || platformKeyHex === 'your_platform_funding_key_here') {
    return { exists: false, valid: false };
  }

  // Check if key is valid (must be 64 hex chars)
  const isValid = /^[0-9a-fA-F]{64}$/.test(platformKeyHex);

  return {
    exists: true,
    valid: isValid,
    key: platformKeyHex
  };
}

/**
 * Loads platform private key from .env file
 */
function loadPlatformKey(): PrivateKey {
  const keyCheck = checkPlatformKeyExists();

  if (!keyCheck.exists) {
    throw new Error(
      'PLATFORM_FUNDING_KEY not found in .env file.\n' +
      'Please run: npx tsx src/scripts/generate-keys.ts'
    );
  }

  if (!keyCheck.valid) {
    throw new Error(
      `PLATFORM_FUNDING_KEY is invalid (must be 64 hex characters).\n` +
      `Current value: ${keyCheck.key!.substring(0, 16)}... (${keyCheck.key!.length} chars)\n` +
      'Please run: npx tsx src/scripts/generate-keys.ts'
    );
  }

  return PrivateKey.fromHex(keyCheck.key!);
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

/**
 * Fund platform wallet from external BRC-100 wallet
 */
async function fundFromExternalWallet(platformAddress: string, fundingAmount: number): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('💰 FUNDING FROM EXTERNAL BRC-100 WALLET');
  console.log('='.repeat(80) + '\n');

  console.log(`📊 Funding Amount: ${fundingAmount.toLocaleString()} satoshis (${(fundingAmount / 100_000_000).toFixed(8)} BSV)\n`);

  // Create P2PKH locking script for the platform public key
  console.log('🔐 Creating P2PKH locking script...');
  const p2pkh = new P2PKH();
  const lockingScript = p2pkh.lock(platformAddress);
  console.log(`   Locking Script: ${lockingScript.toHex().substring(0, 40)}...\n`);

  // Initialize WalletClient to connect to external BRC-100 wallet
  console.log('🔌 Connecting to external BRC-100 wallet...');
  console.log('   (Make sure Metanet Desktop Wallet or another BRC-100 wallet is running)\n');

  const externalWalletClient = new WalletClient('json-api', 'localhost');
  await externalWalletClient.connectToSubstrate();

  console.log('✅ Connected to external wallet!\n');

  // Create action to fund the platform key
  console.log('📤 Creating payment action...');
  const actionResult = await externalWalletClient.createAction({
    description: 'Fund platform key',
    outputs: [
      {
        lockingScript: lockingScript.toHex(),
        satoshis: fundingAmount,
        outputDescription: 'Platform funding UTXO',
        basket: 'platform-funding',
        tags: ['platform', 'funding', 'initial']
      }
    ],
    options: {
      acceptDelayedBroadcast: true,
      returnTXIDOnly: false
    },
  });

  console.log('\n' + '='.repeat(80));
  console.log('✅ FUNDING TRANSACTION CREATED SUCCESSFULLY!');
  console.log('='.repeat(80) + '\n');

  console.log('📋 Transaction Details:');
  console.log(`   TXID: ${actionResult.txid}`);
  console.log(`   Amount: ${fundingAmount.toLocaleString()} satoshis`);
  console.log(`   Recipient: ${platformAddress}`);

  if (actionResult.tx) {
    console.log(`   Transaction Size: ${Math.ceil(actionResult.tx.length / 2)} bytes`);
  }

  console.log('\n📍 Block Explorer:');
  console.log(`   https://whatsonchain.com/tx/${actionResult.txid}`);

  console.log('\n⏳ Transaction Status:');
  console.log('   • Broadcasting to BSV network...');
  console.log('   • Check block explorer for confirmation status');
  console.log('   • Platform will be funded once transaction confirms (~10 minutes)');

  console.log('\n💡 Next Steps:');
  console.log('   1. Wait for transaction confirmation');
  console.log('   2. Re-run this script to verify balance');
  console.log('   3. Start using the platform!');

  console.log('\n' + '='.repeat(80) + '\n');
}

async function fundPlatform(): Promise<void> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('💰 PLATFORM WALLET SETUP & FUNDING');
    console.log('='.repeat(80) + '\n');

    // Check if platform key exists first
    console.log('🔍 Checking for existing platform key...');
    const keyCheck = checkPlatformKeyExists();

    if (!keyCheck.exists) {
      console.error('   ❌ PLATFORM_FUNDING_KEY not found in .env\n');
      console.error('Please generate keys first by running:');
      console.error('   npx tsx src/scripts/generate-keys.ts\n');
      process.exit(1);
    }

    if (!keyCheck.valid) {
      console.error(`   ❌ PLATFORM_FUNDING_KEY is invalid (must be 64 hex characters)\n`);
      console.error(`Current value: ${keyCheck.key!.substring(0, 16)}... (${keyCheck.key!.length} chars)\n`);
      console.error('Please regenerate keys by running:');
      console.error('   npx tsx src/scripts/generate-keys.ts\n');
      process.exit(1);
    }

    console.log('   ✓ Platform key found and valid\n');

    // Check if --fund flag is present
    const shouldFund = process.argv.includes('--fund');
    const fundingAmount = shouldFund
      ? (process.argv[3] && !isNaN(parseInt(process.argv[3], 10))
          ? parseInt(process.argv[3], 10)
          : DEFAULT_FUNDING_AMOUNT)
      : 0;

    if (shouldFund && (isNaN(fundingAmount) || fundingAmount <= 0)) {
      throw new Error('Invalid funding amount. Please provide a positive number of satoshis.');
    }

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
    let currentBalance = 0;
    try {
      currentBalance = await wallet.balance();
      console.log(`   Current Balance: ${currentBalance.toLocaleString()} satoshis (${(currentBalance / 100_000_000).toFixed(8)} BSV)\n`);

      if (currentBalance > 0) {
        console.log('✅ WALLET IS FUNDED!\n');
      } else {
        console.log('⚠️  WALLET HAS ZERO BALANCE\n');
      }
    } catch (balanceError) {
      console.log('   ⚠️  Could not check balance (wallet may not be synced yet)\n');
    }

    // If --fund flag is present, fund from external wallet
    if (shouldFund) {
      await fundFromExternalWallet(platformAddress, fundingAmount);
      return;
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

    console.log('   1. USE THIS SCRIPT WITH EXTERNAL BRC-100 WALLET:');
    console.log('      • Start Metanet Desktop Wallet or another BRC-100 wallet');
    console.log('      • Run: npx tsx src/scripts/fund-platform.ts --fund');
    console.log('      • This will create a funding transaction from your external wallet\n');

    console.log('   2. SEND BSV DIRECTLY TO THE ADDRESS:');
    console.log(`      Address: ${platformAddress}`);
    console.log('      Use any BSV wallet to send funds to this address\n');

    console.log('   3. USE A FAUCET (for testing):');
    console.log('      • Mainnet: https://faucet.bitcoinscaling.io');
    console.log('      • Testnet: https://faucet.satoshisvision.network\n');

    console.log('   4. BUY BSV:');
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

      if (error.message.includes('substrate') || error.message.includes('wallet')) {
        console.error('\n💡 External Wallet Connection Issue:');
        console.error('   • Make sure a BRC-100 wallet is running (e.g., Metanet Desktop Wallet)');
        console.error('   • Check that the wallet is unlocked and has sufficient funds');
        console.error('   • Try closing and reopening the wallet application');
        console.error('   • Ensure no other applications are blocking wallet access');
      }

      if (error.message.includes('funds') || error.message.includes('balance')) {
        console.error('\n💡 Insufficient Funds:');
        console.error('   • Your external wallet does not have enough BSV');
        console.error('   • Please add funds to your BRC-100 wallet first');
        console.error('   • For testnet, use: https://faucet.satoshisvision.network');
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
