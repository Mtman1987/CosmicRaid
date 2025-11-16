const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read the .env file
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

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

console.log(`\n📦 Found ${Object.keys(envVars).length} environment variables\n`);

// Function to upload a single secret to App Hosting
function uploadSecret(key, value) {
  return new Promise((resolve) => {
    console.log(`⏳ Uploading ${key}...`);
    
    const child = spawn('firebase', [
      'apphosting:secrets:set',
      key,
      '--data-file=-'  // Read from stdin
    ], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: __dirname,
      shell: true
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${key} uploaded successfully`);
      } else {
        console.log(`❌ ${key} failed`);
        if (stderr) console.log(`   Error: ${stderr.trim()}`);
      }
      
      resolve({
        key,
        success: code === 0,
        stdout,
        stderr,
        code
      });
    });

    child.on('error', (error) => {
      console.log(`❌ ${key} failed: ${error.message}`);
      resolve({
        key,
        success: false,
        error: error.message
      });
    });

    // Send the value to stdin
    child.stdin.write(value);
    child.stdin.end();
  });
}

// Upload secrets with rate limiting
async function uploadAllSecrets() {
  let successCount = 0;
  let failCount = 0;
  const failed = [];
  const results = [];

  console.log('🚀 Starting upload to Firebase App Hosting Secret Manager\n');
  console.log('This may take a few minutes...\n');

  const entries = Object.entries(envVars);
  
  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    console.log(`\n[${i + 1}/${entries.length}]`);
    
    const result = await uploadSecret(key, value);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
      failed.push(result);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Upload Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total: ${entries.length}`);

  if (failed.length > 0) {
    console.log('\n❌ Failed uploads:');
    failed.forEach(({ key, error, stderr }) => {
      const errorMsg = error || stderr || 'Unknown error';
      console.log(`  - ${key}: ${errorMsg.trim()}`);
    });
    
    console.log('\n💡 To retry failed uploads, run:');
    failed.forEach(({ key }) => {
      console.log(`   firebase apphosting:secrets:set ${key}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('✨ Done!\n');
  
  if (successCount > 0) {
    console.log('📝 Next steps:');
    console.log('1. Verify secrets in Firebase Console');
    console.log('2. Grant access if needed: firebase apphosting:secrets:grantaccess <secret-name>');
    console.log('3. Deploy your app: firebase deploy --only apphosting');
    console.log('4. Check that secrets are accessible in your deployed app\n');
  }
}

// Check if Firebase CLI is available
function checkFirebaseCLI() {
  return new Promise((resolve) => {
    const child = spawn('firebase', ['--version'], { stdio: 'pipe', shell: true });
    
    let version = '';
    child.stdout.on('data', (data) => {
      version = data.toString().trim();
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Firebase CLI found: ${version}\n`);
      }
      resolve(code === 0);
    });
    
    child.on('error', () => {
      resolve(false);
    });
  });
}

// Check if user is authenticated
function checkAuth() {
  return new Promise((resolve) => {
    const child = spawn('firebase', ['projects:list'], { stdio: 'pipe', shell: true });
    child.on('close', (code) => {
      resolve(code === 0);
    });
    child.on('error', () => {
      resolve(false);
    });
  });
}

// Main execution
async function main() {
  console.log('🔍 Checking Firebase CLI...');
  
  const hasFirebase = await checkFirebaseCLI();
  if (!hasFirebase) {
    console.error('❌ Firebase CLI not found!');
    console.error('Please install it: npm install -g firebase-tools');
    process.exit(1);
  }

  console.log('🔐 Checking authentication...');
  const isAuthenticated = await checkAuth();
  if (!isAuthenticated) {
    console.error('❌ Not authenticated with Firebase!');
    console.error('Please run: firebase login');
    process.exit(1);
  }
  
  console.log('✅ Authentication confirmed\n');

  await uploadAllSecrets();
}

main().catch(console.error);
