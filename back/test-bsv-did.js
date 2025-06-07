const http = require('http');

// Test data for creating a DID
const createDidData = JSON.stringify({
  didDocument: {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "",
    "verificationMethod": [{
      "id": "#key-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "",
      "publicKeyHex": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
    }],
    "authentication": ["#key-1"],
    "service": [{
      "id": "#service-1",
      "type": "LinkedDomains",
      "serviceEndpoint": "https://example.com"
    }]
  },
  controllerPublicKeyHex: "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
  feePerKb: 10
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/v1/dids/create',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(createDidData)
  }
};

console.log('Testing BSV DID Create endpoint...');
console.log('Data being sent:', JSON.parse(createDidData));

const req = http.request(options, (res) => {
  console.log(`\nResponse Status: ${res.statusCode}`);
  console.log(`Response Headers:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('\nResponse Body:');
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.log('\nRaw Response Body:');
      console.log(data);
    }
  });
});

req.on('error', (error) => {
  console.error('Request error:', error);
});

req.write(createDidData);
req.end();
