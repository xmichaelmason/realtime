#!/usr/bin/env node

const crypto = require('crypto');

// Simple JWT implementation for testing
function base64URLEncode(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function createJWT(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = base64URLEncode(JSON.stringify(header));
  const encodedPayload = base64URLEncode(JSON.stringify(payload));
  
  const data = encodedHeader + '.' + encodedPayload;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return data + '.' + signature;
}

function generateTestTokens() {
  const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
  const expiresIn = Math.floor(Date.now() / 1000) + (60 * 60 * 24); // 24 hours

  // Test user tokens
  const users = [
    { id: 'user1', name: 'Alice', email: 'alice@example.com' },
    { id: 'user2', name: 'Bob', email: 'bob@example.com' },
    { id: 'user3', name: 'Charlie', email: 'charlie@example.com' }
  ];

  console.log('JWT Secret:', secret);
  console.log('Generated Test Tokens:\n');

  users.forEach(user => {
    const payload = {
      ...user,
      iat: Math.floor(Date.now() / 1000),
      exp: expiresIn
    };

    const token = createJWT(payload, secret);
    
    console.log(`User: ${user.name} (${user.id})`);
    console.log(`Token: ${token}`);
    console.log(`WebSocket URL: ws://localhost:1234?token=${token}`);
    console.log(`Signaling URL: ws://localhost:3001?token=${token}`);
    console.log('---');
  });

  // Generate a long-lived admin token
  const adminPayload = {
    id: 'admin',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30) // 30 days
  };

  const adminToken = createJWT(adminPayload, secret);
  console.log('Admin Token (30 days):');
  console.log(adminToken);
  console.log('\nExample usage in frontend:');
  console.log(`localStorage.setItem('authToken', '${users[0].id === 'user1' ? createJWT({ ...users[0], iat: Math.floor(Date.now() / 1000), exp: expiresIn }, secret) : adminToken}');`);
}

if (require.main === module) {
  generateTestTokens();
}

module.exports = { createJWT, generateTestTokens };
