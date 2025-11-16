# 🌩️ Cosmic Raid Cloud Deployment Guide

## Firebase App Hosting Setup

### 1. Deploy to Firebase App Hosting
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy to App Hosting
firebase deploy --only hosting
```

### 2. Configure Secrets
Set these secrets in Firebase Console → App Hosting → Secrets:

```bash
firebase apphosting:secrets:set CRON_SECRET "your-random-secret-key"
firebase apphosting:secrets:set TWITCH_CLIENT_ID "your-twitch-client-id"
firebase apphosting:secrets:set TWITCH_CLIENT_SECRET "your-twitch-client-secret"
firebase apphosting:secrets:set FREE_CONVERT_API_KEY "your-freeconvert-key"
firebase apphosting:secrets:set SHOTSTACK_API_KEY "your-shotstack-key"
firebase apphosting:secrets:set GEMINI_API_KEY "your-gemini-key"
firebase apphosting:secrets:set DISCORD_CLIENT_ID "your-discord-client-id"
firebase apphosting:secrets:set DISCORD_CLIENT_SECRET "your-discord-secret"
firebase apphosting:secrets:set DISCORD_BOT_TOKEN "your-bot-token"
firebase apphosting:secrets:set HARDCODED_GUILD_ID "your-discord-server-id"
```

### 3. Setup External Cron (Choose One)

#### Option A: GitHub Actions (Recommended)
1. Fork/push your repo to GitHub
2. Set repository secrets:
   - `APP_URL`: Your Firebase App Hosting URL
   - `CRON_SECRET`: Same as Firebase secret
   - `DISCORD_SERVER_ID`: Your Discord server ID
3. Enable GitHub Actions in repository settings

#### Option B: Cron-job.org
1. Go to https://cron-job.org
2. Create account and new cron job
3. Set URL: `https://your-app.web.app/api/cron/poll`
4. Set schedule: `*/5 * * * *` (every 5 minutes)
5. Add header: `Authorization: Bearer your-cron-secret`
6. Set body: `{"serverId": "your-discord-server-id"}`

#### Option C: Google Cloud Scheduler
```bash
gcloud scheduler jobs create http cosmic-raid-poll \
  --schedule="*/5 * * * *" \
  --uri="https://your-app.web.app/api/cron/poll" \
  --http-method=POST \
  --headers="Authorization=Bearer your-cron-secret,Content-Type=application/json" \
  --message-body='{"serverId": "your-discord-server-id"}'
```

## Cloud Architecture

### Serverless Design
- **No long-running processes**: Uses external cron triggers
- **Stateless functions**: Each API call is independent
- **Firebase integration**: Uses Firestore for state management
- **Auto-scaling**: Firebase App Hosting handles traffic spikes

### Data Flow
1. External cron triggers `/api/cron/poll` every 5 minutes
2. Endpoint checks Firestore for polling configuration
3. Fetches Twitch data and updates user status
4. Converts clips to GIFs and caches in Firestore
5. Updates community spotlight and VIP data

### Cost Optimization
- **Minimal compute**: Only runs when triggered
- **Efficient caching**: 24-hour GIF cache reduces API calls
- **Batch processing**: Checks multiple streamers simultaneously
- **Fallback systems**: Reduces failed conversion costs

## Monitoring & Maintenance

### Health Checks
Monitor these endpoints:
- `GET /api/cron/poll` - Cron endpoint status
- `GET /api/polling` - Polling service info
- Firebase Console - Function logs and errors

### Troubleshooting
- Check Firebase Function logs for errors
- Verify cron job is running (GitHub Actions tab)
- Test manual polling via Settings page
- Monitor API quota usage (Twitch, FreeConvert, etc.)

### Scaling
- Increase `maxInstances` in `apphosting.yaml` for high traffic
- Monitor Firebase usage and upgrade plan if needed
- Consider regional deployment for global users

## Security
- All API keys stored as Firebase secrets
- Cron endpoint protected with bearer token
- No sensitive data in client-side code
- Firebase security rules protect Firestore data