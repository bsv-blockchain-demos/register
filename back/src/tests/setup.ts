import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '.env' });

// Set test-specific environment variables
process.env.NODE_ENV = 'test';

// Increase Jest timeout for integration tests
jest.setTimeout(30000);

// Suppress console.log during tests unless DEBUG is set
if (!process.env.DEBUG) {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
}

// Global test cleanup
afterAll(async () => {
  // Add any global cleanup here
});