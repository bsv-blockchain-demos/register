/**
 * fund-platform.ts
 *
 * Funds the platform BSV key using a BRC-100 compliant wallet.
 * Connects to a local wallet (e.g., Metanet Desktop Wallet) via WalletClient
 * and creates a payment action to fund the PLATFORM_FUNDING_KEY.
 *
 * This script uses the BRC-100 Wallet Interface standard to request
 * a payment from any compatible wallet application.
 *
 * Usage: npx tsx src/scripts/fund-platform.ts [amount_in_satoshis]
 *
 * Prerequisites:
 * - A BRC-100 compliant wallet running (e.g., Metanet Desktop Wallet)
 * - Platform keys generated (run generate-keys.ts first)
 */

import { PrivateKey, WalletClient, P2PKH } from '@bsv/sdk';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

/**
 * Default funding amount in satoshis (0.01 BSV = 1,000,000 satoshis)
 */
const DEFAULT_FUNDING_AMOUNT = 0.01 * 1_000_000;

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

  // Load environment variables
  dotenv.config({ path: envPath });

  const platformKeyHex = process.env.PLATFORM_FUNDING_KEY;

  if (!platformKeyHex || platformKeyHex === 'your_platform_funding_key_here') {
    throw new Error(
      'PLATFORM_FUNDING_KEY not found or not set in .env file.\n' +
      'Please run: npx tsx src/scripts/generate-keys.ts'
    );
  }

  return PrivateKey.fromString(platformKeyHex, 'hex');
}

async function fundPlatform(): Promise<void> {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('💰 FUNDING PLATFORM KEY VIA BRC-100 WALLET');
    console.log('='.repeat(80) + '\n');

    // Get funding amount from command line args or use default
    const fundingAmount = process.argv[2]
      ? parseInt(process.argv[2], 10)
      : DEFAULT_FUNDING_AMOUNT;

    if (isNaN(fundingAmount) || fundingAmount <= 0) {
      throw new Error('Invalid funding amount. Please provide a positive number of satoshis.');
    }

    console.log(`📊 Funding Amount: ${fundingAmount.toLocaleString()} satoshis (${(fundingAmount / 100_000_000).toFixed(8)} BSV)\n`);

    // Load platform private key
    console.log('🔑 Loading platform key from .env...');
    const platformKey = loadPlatformKey();
    const platformPublicKey = platformKey.toPublicKey();
    const platformAddress = platformPublicKey.toAddress();

    console.log(`   Private Key: ${platformKey.toHex().substring(0, 16)}...`);
    console.log(`   Public Key:  ${platformPublicKey.toString().substring(0, 32)}...`);
    console.log(`   Address:     ${platformAddress}\n`);

    // Create P2PKH locking script for the platform public key
    console.log('🔐 Creating P2PKH locking script...');
    const p2pkh = new P2PKH();
    const lockingScript = p2pkh.lock(platformAddress);

    console.log(`   Locking Script: ${lockingScript.toHex().substring(0, 40)}...\n`);

    // Initialize WalletClient to connect to BRC-100 wallet
    console.log('🔌 Connecting to BRC-100 wallet...');
    console.log('   (Make sure Metanet Desktop Wallet or another BRC-100 wallet is running)\n');

    const walletClient = new WalletClient('json-api', 'localhost');
    await walletClient.connectToSubstrate();

    console.log('✅ Connected to wallet!\n');

    // Create action to fund the platform key
    console.log('📤 Creating payment action...');
    const actionResult = await walletClient.createAction({
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
    console.log('   2. Verify funding on block explorer');
    console.log('   3. Start using the platform!');

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error instanceof Error ? error.message : String(error));

    if (error instanceof Error) {
      // Check for common BRC-100 wallet connection errors
      if (error.message.includes('substrate') || error.message.includes('wallet')) {
        console.error('\n💡 Troubleshooting:');
        console.error('   • Make sure a BRC-100 wallet is running (e.g., Metanet Desktop Wallet)');
        console.error('   • Check that the wallet is unlocked and has sufficient funds');
        console.error('   • Try closing and reopening the wallet application');
        console.error('   • Ensure no other applications are blocking wallet access');
      }

      if (error.message.includes('funds') || error.message.includes('balance')) {
        console.error('\n💡 Insufficient Funds:');
        console.error('   • Your wallet does not have enough BSV to complete this transaction');
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
