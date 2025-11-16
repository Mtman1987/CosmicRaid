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
    const [key, ...valueParts] = trimmedLine.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=');
      envVars[key.trim()] = value.trim();
    }
  }
}

console.log(`Found ${Object.keys(envVars).length} environment variables to upload`);

// Function to execute Firebase CLI commands
function runFirebaseCommand(command) {
  try {
    const result = execSync(command, { 
      stdio: 'pipe',
      encoding: 'utf8',
      cwd: __dirname
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout || error.stderr };
  }
}

// Upload each secret
let successCount = 0;
let failCount = 0;
const failed = [];

console.log('\nUploading secrets to Firebase...\n');

for (const [key, value] of Object.entries(envVars)) {
  process.stdout.write(`Uploading ${key}... `);
  
  // Create the secret with the value
  const command = `firebase functions:secrets:set ${key} --data-file=-`;
  
  try {
    const child = execSync(command, {
      input: value,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      cwd: __dirname
    });
    
    console.log('✅ Success');
    successCount++;
  } catch (error) {
    console.log('❌ Failed');
    console.log(`   Error: ${error.message}`);
    failed.push({ key, error: error.message });
    failCount++;
  }
}

console.log('\n' + '='.repeat(50));
console.log(`Upload Summary:`);
console.log(`✅ Successful: ${successCount}`);
console.log(`❌ Failed: ${failCount}`);

if (failed.length > 0) {
  console.log('\nFailed uploads:');
  failed.forEach(({ key, error }) => {
    console.log(`  - ${key}: ${error}`);
  });
}

console.log('\n' + '='.repeat(50));
console.log('Done! Your secrets are now available in Firebase Secret Manager.');
console.log('You can view them in the Firebase Console under Functions > Secrets.');