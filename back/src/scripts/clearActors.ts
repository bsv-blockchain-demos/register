import { MongoClient } from 'mongodb';
import 'dotenv/config';

const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "LARS_lookup_services";

async function clearActors() {
  const client = new MongoClient(mongoUri);
  
  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    
    const db = client.db(DB_NAME);
    const actorsCollection = db.collection('actors');
    
    // Count existing actors
    const count = await actorsCollection.countDocuments();
    console.log(`Found ${count} actors in the database`);
    
    if (count > 0) {
      // Delete all actors
      const result = await actorsCollection.deleteMany({});
      console.log(`✅ Successfully deleted ${result.deletedCount} actors`);
    } else {
      console.log('ℹ️  No actors to delete');
    }
    
    // Verify deletion
    const remainingCount = await actorsCollection.countDocuments();
    console.log(`Remaining actors: ${remainingCount}`);
    
  } catch (error) {
    console.error('❌ Error clearing actors:', error);
  } finally {
    await client.close();
    console.log('Database connection closed');
  }
}

// Run the script
clearActors().then(() => {
  console.log('Script completed');
  process.exit(0);
}).catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
