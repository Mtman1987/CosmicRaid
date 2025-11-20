const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Firebase App Hosting Secrets Status Check\n');
console.log('='.repeat(60));

// Read apphosting.yaml to see what secrets are expected
const apphostingYamlPath = path.join(__dirname, 'apphosting.yaml');
if (!fs.existsSync(apphostingYamlPath)) {
  console.error('❌ apphosting.yaml not found!');
  process.exit(1);
}

const apphostingContent = fs.readFileSync(apphostingYamlPath, 'utf8');
const expectedSecrets = new Set();

// Extract secret names from apphosting.yaml using regex
const secretRegex = /\$\{secret:([^}]+)\}/g;
let match;
while ((match = secretRegex.exec(apphostingContent)) !== null) {
  expectedSecrets.add(match[1]);
}

console.log(`\n📋 Expected secrets from apphosting.yaml: ${expectedSecrets.size}\n`);

// Read .env file to see what we have locally
const envPath = path.join(__dirname, '.env');
const localSecrets = new Set();

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const equalIndex = trimmedLine.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex).trim();
        if (key) {
          localSecrets.add(key);
        }
      }
    }
  }
  console.log(`📁 Local secrets in .env: ${localSecrets.size}\n`);
} else {
  console.log('⚠️  No .env file found\n');
}

// Compare
console.log('='.repeat(60));
console.log('\n📊 Status Report:\n');

const missingInYaml = [...localSecrets].filter(s => !expectedSecrets.has(s));
const missingInEnv = [...expectedSecrets].filter(s => !localSecrets.has(s));
const inBoth = [...expectedSecrets].filter(s => localSecrets.has(s));

console.log(`✅ Secrets in both .env and apphosting.yaml: ${inBoth.length}`);
if (inBoth.length > 0 && inBoth.length <= 10) {
  inBoth.forEach(s => console.log(`   - ${s}`));
} else if (inBoth.length > 10) {
  console.log('   (too many to list, showing first 10)');
  inBoth.slice(0, 10).forEach(s => console.log(`   - ${s}`));
  console.log(`   ... and ${inBoth.length - 10} more`);
}

if (missingInEnv.length > 0) {
  console.log(`\n⚠️  Secrets in apphosting.yaml but missing from .env: ${missingInEnv.length}`);
  missingInEnv.forEach(s => console.log(`   - ${s}`));
}

if (missingInYaml.length > 0) {
  console.log(`\n💡 Secrets in .env but not referenced in apphosting.yaml: ${missingInYaml.length}`);
  if (missingInYaml.length <= 20) {
    missingInYaml.forEach(s => console.log(`   - ${s}`));
  } else {
    console.log('   (too many to list)');
  }
}

// Try to check Firebase secrets (this requires firebase CLI and authentication)
console.log('\n='.repeat(60));
console.log('\n🔐 Attempting to check Firebase Secret Manager...\n');

try {
  // This will work if the user has the Firebase CLI installed and is authenticated
  const result = execSync('firebase functions:secrets:get --help 2>&1', { 
    encoding: 'utf8',
    stdio: 'pipe'
  });
  
  if (result.includes('firebase functions:secrets')) {
    console.log('✅ Firebase CLI is available');
    console.log('\n💡 To check secrets in Firebase, use these commands:');
    console.log('   firebase functions:secrets:get <SECRET_NAME>');
    console.log('   firebase apphosting:secrets:describe <SECRET_NAME>');
    console.log('\n💡 To upload secrets, run:');
    console.log('   node upload-apphosting-secrets.js');
  }
} catch (error) {
  console.log('⚠️  Firebase CLI not available or not authenticated');
  console.log('   Install: npm install -g firebase-tools');
  console.log('   Login: firebase login');
}

console.log('\n='.repeat(60));
console.log('\n✨ Summary:\n');
console.log(`1. You have ${expectedSecrets.size} secrets defined in apphosting.yaml`);
console.log(`2. You have ${localSecrets.size} secrets in your .env file`);
console.log(`3. ${inBoth.length} secrets are ready to upload`);

if (missingInEnv.length > 0) {
  console.log(`\n⚠️  WARNING: ${missingInEnv.length} secrets are referenced in apphosting.yaml but missing from .env`);
  console.log('   Your app may not work correctly until these are added.');
}

console.log('\n📝 Next steps:');
console.log('1. Ensure all required secrets are in your .env file');
console.log('2. Run: node upload-apphosting-secrets.js');
console.log('3. Deploy: firebase deploy --only apphosting');
console.log('4. Test your deployed app to verify secrets are accessible\n');
