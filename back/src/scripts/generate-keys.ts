// scripts/generate-keys.ts
import { PrivateKey } from '@bsv/sdk';
import * as fs from 'fs';
import * as path from 'path';

async function generateKeys(): Promise<void> {
  try {
    console.log('🔑 Generating BSV keys...\n');
    
    // Generate MEDICAL_LICENSE_CERTIFIER key
    const medicalKey = PrivateKey.fromRandom();
    const medicalKeyHex = medicalKey.toHex();
    
    // Generate PLATFORM_FUNDING_KEY
    const platformKey = PrivateKey.fromRandom();
    const platformKeyHex = platformKey.toHex();
    
    console.log('Generated Keys:');
    console.log(`MEDICAL_LICENSE_CERTIFIER: ${medicalKeyHex}`);
    console.log(`PLATFORM_FUNDING_KEY: ${platformKeyHex}`);
    
    // Update .env file
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    } else {
      // Read from env.example if .env doesn't exist
      const examplePath = path.join(__dirname, '../../env.example');
      if (fs.existsSync(examplePath)) {
        envContent = fs.readFileSync(examplePath, 'utf8');
      } else {
        throw new Error('Neither .env nor env.example found in backend directory');
      }
    }
    
    // Replace placeholder values
    envContent = envContent.replace(
      /MEDICAL_LICENSE_CERTIFIER=.*/,
      `MEDICAL_LICENSE_CERTIFIER=${medicalKeyHex}`
    );
    envContent = envContent.replace(
      /PLATFORM_FUNDING_KEY=.*/,
      `PLATFORM_FUNDING_KEY=${platformKeyHex}`
    );
    
    // Write updated .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Environment file updated successfully!');
    
  } catch (error) {
    console.error('❌ Error generating keys:', error);
    process.exit(1);
  }
}

// Run the function
generateKeys().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});