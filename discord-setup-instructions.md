# Discord Bot Interactions Setup

## Problem
Discord buttons not responding when clicked - they need to be configured to point to your app's interactions endpoint.

## Solution
Configure your Discord application's Interactions Endpoint URL:

### Steps:
1. Go to https://discord.com/developers/applications
2. Select your bot application
3. Go to "General Information" tab
4. Find "Interactions Endpoint URL" field
5. Set it to: `https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app/api/discord/interactions`
6. Click "Save Changes"

### Verification:
Discord will send a test request to verify the endpoint is working. The endpoint should respond with a verification challenge.

### Current Endpoint:
- **URL**: `/api/discord/interactions`
- **Method**: POST
- **Handles**: Button clicks, modal submissions, slash commands

### Supported Interactions:
- `calendar_captain_log_*` - Opens Captain's Log modal
- `calendar_add_mission_*` - Opens Add Mission modal  
- `calendar_prev_month_*` - Navigate to previous month
- `calendar_next_month_*` - Navigate to next month
- `check_rank_*` - Check user's leaderboard rank

Once configured, Discord buttons should work immediately.