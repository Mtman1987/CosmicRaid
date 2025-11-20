const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read the .env file
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Parse environment variables
const envVars = {};
const lines = envContent.split('\n');

for (const line of lines) {
  const trimmedLine = line.trim();
  if (trimmedLine && !trimmedLine.startsWith('#')) {
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      const value = trimmedLine.substring(equalIndex + 1).trim();
      if (key && value) {
        envVars[key] = value;
      }
    }
  }
}

console.log(`🔍 Checking ${Object.keys(envVars).length} secrets from .env file...\n`);

const existingSecrets = [];
const missingSecrets = [];

for (const key of Object.keys(envVars)) {
  try {
    // Try to get metadata for the secret
    execSync(`firebase functions:secrets:get ${key}`, {
      stdio: 'pipe',
      cwd: __dirname
    });
    existingSecrets.push(key);
    process.stdout.write('✅');
  } catch (error) {
    missingSecrets.push(key);
    process.stdout.write('❌');
  }
  
  // Add a space every 10 secrets for readability
  if ((existingSecrets.length + missingSecrets.length) % 10 === 0) {
    process.stdout.write(' ');
  }
}

console.log('\n');
console.log('='.repeat(60));
console.log(`📊 Results:`);
console.log(`   ✅ Existing secrets: ${existingSecrets.length}`);
console.log(`   ❌ Missing secrets: ${missingSecrets.length}`);
console.log(`   📝 Total in .env: ${Object.keys(envVars).length}`);

if (missingSecrets.length > 0) {
  console.log(`\n❌ Missing secrets:`);
  missingSecrets.forEach((key, index) => {
    console.log(`   ${index + 1}. ${key}`);
  });
}

if (existingSecrets.length > 0) {
  console.log(`\n✅ Existing secrets:`);
  existingSecrets.slice(0, 10).forEach((key, index) => {
    console.log(`   ${index + 1}. ${key}`);
  });
  if (existingSecrets.length > 10) {
    console.log(`   ... and ${existingSecrets.length - 10} more`);
  }
}

console.log('\n='.repeat(60));