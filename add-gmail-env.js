const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');

// Read existing .env file
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Check what's missing
const requiredVars = {
  'GOOGLE_CLIENT_ID': 'your-client-id.apps.googleusercontent.com',
  'GOOGLE_CLIENT_SECRET': 'your-client-secret',
  'GOOGLE_REDIRECT_URI': 'http://localhost:3000/api/gmail/callback'
};

let needsUpdate = false;
const lines = envContent.split('\n');
const existingVars = new Set();

// Check existing variables
lines.forEach(line => {
  const match = line.match(/^([A-Z_]+)=/);
  if (match) {
    existingVars.add(match[1]);
  }
});

// Add missing variables
Object.keys(requiredVars).forEach(varName => {
  if (!existingVars.has(varName)) {
    envContent += `\n${varName}=${requiredVars[varName]}\n`;
    needsUpdate = true;
    console.log(`✅ Added ${varName} to .env`);
  } else {
    console.log(`✓ ${varName} already exists in .env`);
  }
});

if (needsUpdate) {
  fs.writeFileSync(envPath, envContent, 'utf8');
  console.log('\n✅ .env file updated!');
  console.log('\n⚠️  IMPORTANT: Replace the placeholder values with your actual Google OAuth credentials:');
  console.log('   1. Go to https://console.cloud.google.com/');
  console.log('   2. Create/select a project');
  console.log('   3. Enable Gmail API');
  console.log('   4. Create OAuth 2.0 credentials');
  console.log('   5. Copy Client ID and Client Secret to .env');
  console.log('   6. Set GOOGLE_REDIRECT_URI to: http://localhost:3000/api/gmail/callback');
} else {
  console.log('\n✅ All required Gmail OAuth variables are already in .env');
  console.log('   Make sure they have real values (not placeholders)!');
}

