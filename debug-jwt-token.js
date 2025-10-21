// Debug script to inspect JWT token contents
// Run with: node debug-jwt-token.js

const jwt = require('jsonwebtoken');

// You can paste your JWT token here, or we'll try to get it from localStorage simulation
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

function inspectJWT(token) {
  try {
    console.log('🔍 JWT Token Analysis:\n');

    // Decode without verification to see raw contents
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded) {
      console.log('❌ Unable to decode token');
      return;
    }

    console.log('📋 Token Header:');
    console.log(JSON.stringify(decoded.header, null, 2));

    console.log('\n📋 Token Payload:');
    console.log(JSON.stringify(decoded.payload, null, 2));

    // Check for permission level
    const payload = decoded.payload;
    console.log('\n🔍 Permission Analysis:');
    console.log(`   permission_level: ${payload.permission_level || 'NOT FOUND'}`);
    console.log(`   permissionLevel: ${payload.permissionLevel || 'NOT FOUND'}`);
    console.log(`   level: ${payload.level || 'NOT FOUND'}`);

    // Check expiration
    if (payload.exp) {
      const expDate = new Date(payload.exp * 1000);
      const now = new Date();
      console.log(`\n⏰ Token Expiration:`);
      console.log(`   Expires: ${expDate.toISOString()}`);
      console.log(`   Current: ${now.toISOString()}`);
      console.log(`   Status: ${now < expDate ? '✅ Valid' : '❌ Expired'}`);
    }

  } catch (error) {
    console.error('❌ Token inspection error:', error.message);
  }
}

// Get token from command line argument
const token = process.argv[2];

if (!token) {
  console.log(`
🔧 JWT Token Inspector

Usage: node debug-jwt-token.js <JWT_TOKEN>

Example: node debug-jwt-token.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

💡 To get your token:
1. Open browser Dev Tools (F12)
2. Go to Application > Local Storage > http://localhost:3000
3. Look for 'auth_token' or similar key
4. Copy the token value
  `);
} else {
  inspectJWT(token);
}