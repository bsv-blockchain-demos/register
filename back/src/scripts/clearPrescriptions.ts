import { MongoClient } from 'mongodb';
import 'dotenv/config';

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.APP_DB_NAME || "quarkid_prescriptions_db";

async function clearPrescriptions() {
  const client = new MongoClient(mongoUri);

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();

    const db = client.db(DB_NAME);
    const prescription_tokensCollection = db.collection('prescription_tokens');

    // Count existing actors
    const count = await prescription_tokensCollection.countDocuments();
    console.log(`Found ${count} prescriptions in the database`);

    if (count > 0) {
      // Delete all prescriptions
      const result = await prescription_tokensCollection.deleteMany({});
      console.log(`✅ Successfully deleted ${result.deletedCount} prescriptions`);
    } else {
      console.log('ℹ️  No prescriptions to delete');
    }

    // Verify deletion
    const remainingCount = await prescription_tokensCollection.countDocuments();
    console.log(`Remaining prescriptions: ${remainingCount}`);

  } catch (error) {
    console.error('❌ Error clearing prescriptions:', error);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

// Run the script
clearPrescriptions().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

