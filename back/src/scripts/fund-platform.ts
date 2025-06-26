import { PrivateKey } from '@bsv/sdk';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function fundPlatform(): Promise<void> {
  try {
    console.log('₿ Funding platform address...\n');
    
    // Read .env file
    const envPath = path.join(__dirname, '../../.env');
    
    if (!fs.existsSync(envPath)) {
      throw new Error('.env file not found. Run "make setup-env" first to generate keys.');
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const platformKeyMatch = envContent.match(/PLATFORM_FUNDING_KEY=([^\n]+)/);
    
    if (!platformKeyMatch) {
      throw new Error('PLATFORM_FUNDING_KEY not found in .env file. Run "make setup-env" first.');
    }
    
    const platformKeyHex = platformKeyMatch[1].trim();
    
    if (!platformKeyHex || platformKeyHex === 'your_platform_funding_key_here') {
      throw new Error('PLATFORM_FUNDING_KEY is not set. Run "make setup-env" first to generate keys.');
    }
    
    
    console.log('Platform key:', platformKeyHex);
    console.log('Funding Amount: 6900 sats');
    console.log('');
    
    // Execute fund-metanet command
    const command = `npx fund-metanet ${platformKeyHex} 6900`;
    console.log(`Executing: ${command}`);
    console.log('');
    
    try {
      execSync(command, { 
        stdio: 'inherit',
        cwd: path.join(__dirname, '../../') // Run from backend directory
      });
      
      console.log('\n✅ Platform address funded successfully with 6900 sats!');
      console.log(`📍 Key: ${platformKeyHex}`);
      
    } catch (execError) {
      console.error('\n❌ Error executing fund-metanet:');
      console.error(execError.message);
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error funding platform:', error.message);
    process.exit(1);
  }
}

// Run the function
fundPlatform().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 