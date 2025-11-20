#!/usr/bin/env node
/**
 * Quick setup script for Cloud Scheduler
 * Generates the gcloud command to create the scheduler job
 */

const APP_URL = 'https://cosmicraid--studio-5587063777-d2e6c.us-central1.hosted.app';
const CRON_ENDPOINT = `${APP_URL}/api/cron/shoutouts`;

console.log('🚀 Cloud Scheduler Setup for Automated Shoutouts\n');
console.log('This will set up a cron job to trigger shoutouts every 10 minutes.\n');
console.log('=' .repeat(70));
console.log('\n📋 Step 1: Enable Cloud Scheduler API');
console.log('Run this command:\n');
console.log('gcloud services enable cloudscheduler.googleapis.com\n');
console.log('=' .repeat(70));
console.log('\n📋 Step 2: Create the Scheduler Job');
console.log('Run this command:\n');

const command = `gcloud scheduler jobs create http shoutout-automation \\
  --schedule="*/10 * * * *" \\
  --uri="${CRON_ENDPOINT}" \\
  --http-method=POST \\
  --headers="Content-Type=application/json" \\
  --headers="X-CloudScheduler=true" \\
  --location=us-central1 \\
  --description="Triggers automated shoutout generation every 10 minutes"`;

console.log(command);
console.log('\n' + '='.repeat(70));
console.log('\n📋 Step 3: Test the Job');
console.log('Run this command:\n');
console.log('gcloud scheduler jobs run shoutout-automation --location=us-central1\n');
console.log('=' .repeat(70));
console.log('\n✅ After setup:');
console.log('   • Shoutouts will run every 10 minutes automatically');
console.log('   • Works 24/7 even when your PC is off');
console.log('   • Uses Twitch clips + FreeConvert when Puppeteer service unavailable');
console.log('   • Falls back to text-only shoutouts if needed');
console.log('\n💡 Optional: Run Electron app for Puppeteer-generated GIFs/videos');
console.log('   Otherwise, Twitch clips and text shoutouts work great!\n');
console.log('📖 Full guide: docs/CLOUD-SCHEDULER-SETUP.md\n');
