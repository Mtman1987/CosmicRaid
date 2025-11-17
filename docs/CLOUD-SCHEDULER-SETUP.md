# ⏰ Cloud Scheduler Setup for Automated Shoutouts

This guide shows you how to set up Google Cloud Scheduler to automatically trigger shoutouts every 10 minutes, **even when your local Electron app isn't running**.

## Why You Need This

**Problem:** App Hosting is serverless - it can't keep `setInterval` running
- Without Cloud Scheduler: Shoutouts only run when Electron app is running
- With Cloud Scheduler: Shoutouts run 24/7 automatically on the cloud

**Fallback Chain:**
1. If Puppeteer service (ngrok tunnel) is available → Use it for GIFs/videos
2. Else → Try Twitch clips + FreeConvert
3. Else → Post text-only shoutouts

All three work independently of your local machine!

## Setup Steps

### 1. Enable Cloud Scheduler API

```bash
gcloud services enable cloudscheduler.googleapis.com
```

Or in the [Google Cloud Console](https://console.cloud.google.com/apis/library/cloudscheduler.googleapis.com)

### 2. Create the Scheduler Job

**Option A: Using gcloud CLI**

```bash
gcloud scheduler jobs create http shoutout-automation \
  --schedule="*/10 * * * *" \
  --uri="https://cosmicraid--studio-5587063777-d2e6c.us-central1.hosted.app/api/cron/shoutouts" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --headers="X-CloudScheduler=true" \
  --location=us-central1 \
  --description="Triggers automated shoutout generation every 10 minutes"
```

**Option B: Using Cloud Console**

1. Go to [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler)
2. Click **Create Job**
3. Fill in:
   - **Name:** `shoutout-automation`
   - **Region:** `us-central1`
   - **Description:** Triggers automated shoutout generation every 10 minutes
   - **Frequency:** `*/10 * * * *` (every 10 minutes)
   - **Timezone:** Your timezone (e.g., `America/New_York`)
   - **Target type:** HTTP
   - **URL:** `https://cosmicraid--studio-5587063777-d2e6c.us-central1.hosted.app/api/cron/shoutouts`
   - **HTTP method:** POST
   - **Headers:**
     - `Content-Type: application/json`
     - `X-CloudScheduler: true`
4. Click **Create**

### 3. Test the Job

```bash
# Manually trigger the job to test
gcloud scheduler jobs run shoutout-automation --location=us-central1
```

Or click **Run Now** in the Cloud Console.

Check your Discord channels - you should see shoutouts posted!

## Cron Schedule Examples

- `*/10 * * * *` - Every 10 minutes
- `*/15 * * * *` - Every 15 minutes
- `0 * * * *` - Every hour on the hour
- `0 */2 * * *` - Every 2 hours
- `0 9-17 * * *` - Every hour from 9 AM to 5 PM

## How It Works

```
Cloud Scheduler (every 10 min)
  ↓
POST /api/cron/shoutouts
  ↓
runAutomatedShoutoutCycle(serverId)
  ↓
├─ Check if enough time passed (10 min cooldown)
├─ Clean up old clips
├─ Update VIP spotlights
├─ Generate all shoutouts
│   ├─ Try Puppeteer (if ngrok URL in Firestore) → GIF/video
│   ├─ Else try Twitch clips + FreeConvert → GIF
│   └─ Else text-only shoutout
├─ Update community spotlight
└─ Post to Discord
```

## Cost

Cloud Scheduler free tier: **3 jobs free per month**

After that: **$0.10 per job per month**

One job running every 10 minutes = ~4,320 invocations/month = **$0.10/month**

## Monitoring

**View logs:**
```bash
gcloud scheduler jobs describe shoutout-automation --location=us-central1
```

**View execution history:**
```bash
gcloud logging read "resource.type=cloud_scheduler_job AND resource.labels.job_id=shoutout-automation" --limit=10
```

Or check [Cloud Scheduler Console](https://console.cloud.google.com/cloudscheduler) for success/failure status.

## With vs Without Electron App

### Cloud Scheduler Running (always):
- ✅ Shoutouts run every 10 minutes
- ✅ Twitch clips + FreeConvert fallback works
- ✅ Text-only shoutouts work
- ❌ No Puppeteer GIFs/videos (unless Electron app also running)

### Cloud Scheduler + Electron App Running:
- ✅ Shoutouts run every 10 minutes
- ✅ Puppeteer GIFs/videos via ngrok tunnel
- ✅ Twitch clips + FreeConvert fallback
- ✅ Text-only shoutouts

### Only Electron App Running (no Cloud Scheduler):
- ✅ Shoutouts run every 10 minutes (while app is running)
- ✅ Puppeteer GIFs/videos
- ❌ Stops when you quit the app or restart your PC

## Recommended Setup

**Use Cloud Scheduler** - This ensures shoutouts ALWAYS run, even if:
- Your PC is off
- Electron app crashes
- You forget to start the app
- Your internet goes down

**Optionally run Electron app** when you want fancy Puppeteer-generated GIFs with custom designs. Otherwise, Twitch clips or text shoutouts work great!

## Security (Optional)

To prevent unauthorized access to the cron endpoint, you can:

1. **Use Cloud Scheduler service account:**
   ```bash
   gcloud iam service-accounts create scheduler-sa --display-name="Cloud Scheduler Service Account"
   
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:scheduler-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/cloudscheduler.jobRunner"
   ```

2. **Update the scheduler job to use OIDC auth:**
   ```bash
   gcloud scheduler jobs update http shoutout-automation \
     --oidc-service-account-email="scheduler-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --location=us-central1
   ```

3. **Validate the token in your API endpoint** (update `/api/cron/shoutouts/route.ts`)

## Troubleshooting

**Job fails with 404:**
- Check the URL is correct
- Make sure App Hosting deployment is live
- Verify the endpoint exists: `curl https://your-app.hosted.app/api/cron/shoutouts`

**Job succeeds but no shoutouts:**
- Check App Hosting logs: `gcloud app logs tail -s default`
- Verify Discord bot token is valid
- Check that users have `isOnline: true` and `dailyShoutout` generated

**Multiple shoutouts posting:**
- Check that only ONE Cloud Scheduler job exists
- Verify Electron app isn't also pinging the endpoint
- The 10-minute cooldown should prevent duplicates

## Alternative: Uptime Robot (Free)

If you don't want to set up Cloud Scheduler, use [Uptime Robot](https://uptimerobot.com/):

1. Create a free account
2. Add new monitor:
   - Type: HTTP(S)
   - URL: `https://your-app.hosted.app/api/cron/shoutouts`
   - Interval: 10 minutes
3. Done! It will ping your endpoint every 10 minutes for free.

This is simpler but less reliable than Cloud Scheduler.
