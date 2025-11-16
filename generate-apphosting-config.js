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

// Reserved keys that can't be secrets
const reservedKeys = ['GOOGLE_CLOUD_PROJECT', 'FIREBASE_ADMIN_PROJECT_ID'];

// Generate the env section for apphosting.yaml
let envSection = '';
for (const key of Object.keys(envVars).sort()) {
  if (!reservedKeys.includes(key)) {
    envSection += `    ${key}: \${secret:${key}}\n`;
  }
}

const apphostingConfig = `# Settings to manage and configure a Firebase App Hosting backend.
# https://firebase.google.com/docs/app-hosting/configure

runConfig:
  maxInstances: 1
  
  env:
${envSection}`;

// Write the updated apphosting.yaml
fs.writeFileSync('apphosting.yaml', apphostingConfig);
console.log('✅ Updated apphosting.yaml with all 96 secrets');
console.log('🚀 Ready to deploy with: firebase deploy --only apphosting');