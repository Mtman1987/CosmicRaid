# 🔥 Firebase Integration Setup

## Quick Setup (2 commands)

```bash
# 1. Deploy Firebase Functions
cd functions && npm install && cd ..
firebase deploy --only functions

# 2. Set environment variable
firebase functions:config:set app.url="https://your-app-hosting-url.web.app"
```

## What This Does

✅ **Automatic Polling**: Firebase Function runs every 5 minutes  
✅ **Native Integration**: No external services needed  
✅ **Manual Trigger**: Call `triggerPoll` function anytime  
✅ **Built-in Monitoring**: Firebase Console shows logs and metrics  

## Functions Created

- `twitchPolling`: Runs every 5 minutes automatically
- `triggerPoll`: Manual trigger via HTTP request

## Usage

**Automatic**: Just deploy and it works  
**Manual**: Visit `https://your-region-your-project.cloudfunctions.net/triggerPoll`

## Monitoring

Firebase Console → Functions → View logs and execution metrics

This is the cleanest solution - fully integrated with Firebase!