/**
 * sync-env.ts
 *
 * Consolidates .env files across the project by creating symlinks (Unix/Mac)
 * or copies (Windows) from component directories to the master .env file.
 *
 * Usage: npx tsx src/scripts/sync-env.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MASTER_ENV_PATH = path.resolve(__dirname, '../../../.env');
const ENV_TARGETS = [
  { dir: path.resolve(__dirname, '../../'), name: 'back/' },
  { dir: path.resolve(__dirname, '../../../front'), name: 'front/' },
  { dir: path.resolve(__dirname, '../../../overlay/local-data'), name: 'overlay/local-data/' }
];

/**
 * Check if running on Windows
 */
function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Create symlink or copy file based on platform
 */
function createEnvLink(targetDir: string, targetName: string): void {
  const targetFile = path.join(targetDir, '.env');

  // Remove existing file if it exists
  if (fs.existsSync(targetFile)) {
    console.log(`  Removing existing .env file...`);
    fs.unlinkSync(targetFile);
  }

  try {
    if (isWindows()) {
      // Windows: Try to create symlink with mklink, fall back to copy
      try {
        // mklink requires admin privileges on Windows
        execSync(`mklink "${targetFile}" "${MASTER_ENV_PATH}"`, { stdio: 'ignore' });
        console.log(`  ✓ Created symlink: ${targetFile} -> ${MASTER_ENV_PATH}`);
      } catch (symlinkError) {
        // Fall back to copying
        fs.copyFileSync(MASTER_ENV_PATH, targetFile);
        console.log(`  ✓ Copied .env to: ${targetFile}`);
        console.log(`    ⚠️  NOTE: Changes to master .env require re-running this script`);
      }
    } else {
      // Unix/Mac: Create symlink
      fs.symlinkSync(MASTER_ENV_PATH, targetFile);
      console.log(`  ✓ Created symlink: ${targetFile} -> ${MASTER_ENV_PATH}`);
    }
  } catch (error) {
    console.error(`  ✗ Failed to create link for ${targetName}:`, error);
    throw error;
  }
}

async function syncEnv(): Promise<void> {
  try {
    console.log('🔧 BlockMed Environment Sync');
    console.log('='.repeat(80));
    console.log();

    // Check if master .env exists
    if (!fs.existsSync(MASTER_ENV_PATH)) {
      console.error('❌ Error: Master .env file not found at:', MASTER_ENV_PATH);
      console.error('   Please ensure the master .env file exists at project root');
      process.exit(1);
    }

    console.log('✓ Found master .env file at:', MASTER_ENV_PATH);
    console.log();

    // Create symlinks for each component
    console.log('Creating environment links...');
    console.log();

    for (const target of ENV_TARGETS) {
      if (fs.existsSync(target.dir)) {
        console.log(`📦 ${target.name}:`);
        createEnvLink(target.dir, target.name);
        console.log();
      } else {
        console.log(`⚠️  Skipping ${target.name} (directory not found)`);
        console.log();
      }
    }

    console.log('='.repeat(80));
    console.log('✅ Environment sync complete!');
    console.log('='.repeat(80));
    console.log();

    console.log('💡 Tips:');
    console.log('   • Edit the master .env file at project root');
    console.log('   • Changes will automatically apply to all components (via symlinks)');

    if (isWindows()) {
      console.log('   • Windows: If using copies, re-run this script after changes');
    }
    console.log();

  } catch (error) {
    console.error('\n❌ Error syncing environment files:', error);
    if (error instanceof Error) {
      console.error('   Details:', error.message);
    }
    process.exit(1);
  }
}

// Run the function
if (require.main === module) {
  syncEnv().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { syncEnv };