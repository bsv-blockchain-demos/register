/**
 * generate-keys.ts
 *
 * Generates BSV private keys and addresses for platform use.
 * Creates MEDICAL_LICENSE_CERTIFIER and PLATFORM_FUNDING_KEY with derived addresses.
 * Updates .env file with generated values.
 *
 * Usage: npx tsx src/scripts/generate-keys.ts
 */

import { PrivateKey, PublicKey, P2PKH } from '@bsv/sdk';
import * as fs from 'fs';
import * as path from 'path';

interface GeneratedKeyPair {
  privateKeyHex: string;
  privateKeyWIF: string;
  publicKeyHex: string;
  address: string;
}

/**
 * Generates a new BSV key pair with all derived information
 */
function generateKeyPair(): GeneratedKeyPair {
  // Generate random private key
  const privateKey = PrivateKey.fromRandom();

  // Derive public key
  const publicKey = privateKey.toPublicKey();

  // Derive address using P2PKH (Pay to Public Key Hash)
  const address = publicKey.toAddress();

  return {
    privateKeyHex: privateKey.toHex(),
    privateKeyWIF: privateKey.toWif(),
    publicKeyHex: publicKey.toString(),
    address: address
  };
}

/**
 * Updates or adds a key-value pair in .env content
 */
function updateEnvVariable(envContent: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(envContent)) {
    // Replace existing value
    return envContent.replace(regex, `${key}=${value}`);
  } else {
    // Append new value
    return envContent.trim() + `\n${key}=${value}\n`;
  }
}

async function generateKeys(): Promise<void> {
  try {
    console.log('🔑 Generating BSV Keys for Platform...\n');
    console.log('='.repeat(80));

    // Generate MEDICAL_LICENSE_CERTIFIER key pair
    console.log('\n📋 Generating MEDICAL_LICENSE_CERTIFIER key...');
    const medicalKeyPair = generateKeyPair();

    console.log('\nMedical License Certifier Key:');
    console.log(`  Private Key (Hex):  ${medicalKeyPair.privateKeyHex}`);
    console.log(`  Private Key (WIF):  ${medicalKeyPair.privateKeyWIF}`);
    console.log(`  Public Key:         ${medicalKeyPair.publicKeyHex}`);
    console.log(`  Address:            ${medicalKeyPair.address}`);

    // Generate PLATFORM_FUNDING_KEY pair
    console.log('\n\n💰 Generating PLATFORM_FUNDING_KEY...');
    const platformKeyPair = generateKeyPair();

    console.log('\nPlatform Funding Key:');
    console.log(`  Private Key (Hex):  ${platformKeyPair.privateKeyHex}`);
    console.log(`  Private Key (WIF):  ${platformKeyPair.privateKeyWIF}`);
    console.log(`  Public Key:         ${platformKeyPair.publicKeyHex}`);
    console.log(`  Address:            ${platformKeyPair.address}`);

    // Update master .env file at project root
    console.log('\n\n📝 Updating master .env file...');
    const envPath = path.join(__dirname, '../../../.env');
    let envContent = '';

    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
      console.log(`  Found existing .env file at: ${envPath}`);
    } else {
      // Try to read from .env.example as template
      const examplePath = path.join(__dirname, '../../../.env.example');
      if (fs.existsSync(examplePath)) {
        envContent = fs.readFileSync(examplePath, 'utf8');
        console.log(`  Created .env from template: ${examplePath}`);
      } else {
        // Create minimal .env content
        envContent = '# BSV Wallet Configuration\n';
        console.log('  Creating new .env file');
      }
    }

    // Update all environment variables
    envContent = updateEnvVariable(envContent, 'MEDICAL_LICENSE_CERTIFIER', medicalKeyPair.privateKeyHex);
    envContent = updateEnvVariable(envContent, 'PLATFORM_FUNDING_KEY', platformKeyPair.privateKeyHex);
    envContent = updateEnvVariable(envContent, 'PLATFORM_FUNDING_ADDRESS', platformKeyPair.address);

    // Write updated .env file
    fs.writeFileSync(envPath, envContent);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Keys Generated and Saved Successfully!');
    console.log('='.repeat(80));

    console.log('\n⚠️  SECURITY WARNING:');
    console.log('  The private keys have been saved to .env file.');
    console.log('  Keep this file secure and never commit it to version control!');
    console.log('  Make sure .env is listed in your .gitignore file.');

    console.log('\n📌 Next Steps:');
    console.log('  1. Fund the platform address with BSV:');
    console.log(`     Address: ${platformKeyPair.address}`);
    console.log('  2. Run: npx tsx src/scripts/fund-platform.ts');
    console.log('     (This will show instructions for funding)');

  } catch (error) {
    console.error('\n❌ Error generating keys:', error);
    if (error instanceof Error) {
      console.error('   Details:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the function
if (require.main === module) {
  generateKeys().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { generateKeys, generateKeyPair };