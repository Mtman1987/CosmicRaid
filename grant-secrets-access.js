const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔐 Granting App Hosting backend access to secrets\n');

// Read apphosting.yaml to get secret names
const apphostingYamlPath = path.join(__dirname, 'apphosting.yaml');
const apphostingContent = fs.readFileSync(apphostingYamlPath, 'utf8');

const expectedSecrets = new Set();
const secretRegex = /\$\{secret:([^}]+)\}/g;
let match;
while ((match = secretRegex.exec(apphostingContent)) !== null) {
  expectedSecrets.add(match[1]);
}

console.log(`📋 Found ${expectedSecrets.size} secrets to grant access to\n`);

const backend = 'cosmicraid';
const location = 'us-central1';

let successCount = 0;
let failCount = 0;

for (const secretName of expectedSecrets) {
  try {
    console.log(`⏳ Granting access to ${secretName}...`);
    
    execSync(
      `firebase apphosting:secrets:grantaccess ${secretName} --backend ${backend} --location ${location}`,
      { 
        stdio: 'pipe',
        cwd: __dirname 
      }
    );
    
    console.log(`✅ ${secretName} access granted`);
    successCount++;
  } catch (error) {
    console.log(`❌ ${secretName} failed: ${error.message}`);
    failCount++;
  }
}

console.log('\n' + '='.repeat(60));
console.log('📊 Summary:');
console.log(`✅ Success: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);
console.log('='.repeat(60));

if (successCount > 0) {
  console.log('\n✨ Access granted! Now trigger a new deployment:');
  console.log('   1. Make a small change (or just push)');
  console.log('   2. git push origin apphosting');
  console.log('   3. Wait for deployment to complete');
  console.log('   4. Test: /api/diagnostics\n');
}
