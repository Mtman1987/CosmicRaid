# 🚀 Cosmic Raid - Firebase Studio Project

A comprehensive Discord bot and web application for managing streamer communities with advanced shoutout systems, Twitch integration, and AI-powered content generation. Features real-time stream monitoring, GIF conversion, and automated community engagement.

## 🚀 Quick Start

### 1. Environment Setup
Copy `.env.local.example` to `.env` and configure:

```bash
# Required APIs
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
FREE_CONVERT_API_KEY=your_freeconvert_api_key
GEMINI_API_KEY=your_gemini_api_key

# Discord
DISCORD_BOT_TOKEN=your_bot_token
HARDCODED_GUILD_ID=your_discord_server_id

# Firebase (auto-configured)
NEXT_PUBLIC_FIREBASE_PROJECT_ID=studio-5587063777-d2e6c
```

### 2. Install & Deploy
```bash
# Install dependencies
npm install

# Deploy to Firebase (App Hosting + Functions)
firebase deploy

# Setup automatic polling (Firebase Function hits `/api/polling` every 10 min)
cd functions && npm install && cd ..
# functions/.env
# APP_URL=https://your-app.web.app
# SERVER_ID=your_discord_server_id
firebase deploy --only functions
# (Optional) Hit https://<region>-<project>.cloudfunctions.net/triggerPoll to force a poll immediately
```

### 3. Initial Configuration
1. Go to Settings page
2. Click "Sync with Discord" to populate user data
3. Enable "Twitch Polling" for automatic stream monitoring
4. Test shoutout generation for each group type

```
# .env

# --- Discord Bot ---
# Get this from your bot's application page in the Discord Developer Portal.
# This is essential for the bot to authenticate with Discord's API.
DISCORD_BOT_TOKEN="YOUR_DISCORD_BOT_TOKEN_HERE"


# --- Twitch Integration (for future development) ---
# Create an application in the Twitch Developer Console to get these.
# Required for listening to chat, follows, subs, and other events.
TWITCH_CLIENT_ID="YOUR_TWITCH_CLIENT_ID_HERE"
TWITCH_CLIENT_SECRET="YOUR_TWITCH_CLIENT_SECRET_HERE"

# --- Internal Points Service ---
# Secret shared between the Twitch worker and the web app.
POINTS_SERVICE_SECRET="CHANGE_ME"
# Default Discord server to credit when triggering events via scripts.
POINTS_SERVER_ID="YOUR_DISCORD_SERVER_ID"
# Override if the Next.js app is hosted elsewhere.
# POINTS_API_URL="http://localhost:3000/api/points/update"

```

### Service Account Storage (Local + Hosted)

Keep your Firebase Admin JSON file locally (outside of git) and point to it when running
`npm run dev`/`npm run dev:hosted`:

```
GOOGLE_APPLICATION_CREDENTIALS=./studio-9468926194-e03ac-firebase-adminsdk.json
```

For Firebase App Hosting, load the same JSON via secrets and add an optional Firestore fallback:

1. **Secret** – store the entire JSON as a secret:
   ```bash
   firebase apphosting:secrets:set GOOGLE_APPLICATION_CREDENTIALS_JSON @path/to/service-account.json
   ```
   `apphosting.yaml` injects this into `GOOGLE_APPLICATION_CREDENTIALS_JSON`.

2. **Firestore fallback** (optional) – create the document
   `infrastructure/credentials/adminServiceAccount` with a field
   `serviceAccountBase64` that contains the base64-encoded JSON. The helper
   `node scripts/store-service-account.js path/to/serviceAccount.json` automates this.
   It relies on your local service account to write the doc. Once stored, the hosted
   runtime can read it with the configured API key (ensure Firestore rules allow it).
   You can configure a different doc/field via
   `FIREBASE_SERVICE_ACCOUNT_DOC_PATH` / `FIREBASE_SERVICE_ACCOUNT_DOC_FIELD`.

At runtime, the resolver tries secrets first, then the local file path, then the Firestore document,
and finally `applicationDefault()` if the environment already has GCP credentials.

### Initial Data Sync

After configuring your `.env` file, the first thing you must do is run the database sync.

1.  Start the application (`npm run dev`).
2.  Navigate to the `/settings` page in your browser.
3.  Enter your Discord Server ID and click the **"Sync with Discord"** button.

This will populate your Firestore database with your server's members, roles, and channels, which is required for all other features to work.

### Hosted Worker Mode

When the main application is deployed to Firebase App Hosting you can still run Puppeteer/FFmpeg flows locally (for higher quality GIFs) without launching the entire Space Mountain dock:

```bash
# Optional: point local jobs to the hosted base URL
export HOSTED_APP_URL=https://cosmicraid--studio-5587063777-d2e6c.us-central1.hosted.app

# Start only the lightweight worker server (defaults to port 3300)
npm run dev:hosted
```

Override the port with `HOSTED_DEV_PORT`. The hosted worker exposes the same API routes as `npm run dev` so local GIF generation runs first; if this process is offline the backend automatically falls back to the FreeConvert pipeline.

---

## Twitch Points Worker

The `startup.ts` script boots a lightweight worker that authenticates with Twitch and forwards events to the points API.

```
TWITCH_CLIENT_ID=...
TWITCH_CLIENT_SECRET=...
POINTS_SERVER_ID=...
POINTS_SERVICE_SECRET=...
POINTS_API_URL=http://localhost:3000/api/points/update

# Optional: emit fake events every 15s for local testing
MOCK_TWITCH_EVENTS=1
MOCK_TWITCH_USER_IDS=alice,bob
```

Run it with your preferred TypeScript runner (`npx tsx startup.ts`, `ts-node`, etc.). Pass `--event '{"userId":"alice","eventType":"follow"}'` for one-off awards.

---

## 🛠️ Project Status & Feature Breakdown

This section outlines the current state of the app's core features and the vision for future development.

### 1. Discord Bot & Interaction API

*   **Current State:** The application has a powerful API endpoint at `/api/discord/interactions` ready to receive all interactions from a Discord bot (slash commands, button clicks, modal submissions). It can successfully process these events, save data to Firestore, and respond to Discord.
*   **Future Plans:**
    *   **Bot Registration:** A bot needs to be created in the **Discord Developer Portal**.
    *   **Command Registration:** The `/calendar` slash command needs to be registered for that bot. When a user runs `/calendar post`, the bot should send the request to this app's API endpoint.
    *   **Permissions:** The bot will need permissions to `Read Messages/View Channels`, `Send Messages`, `Manage Messages` (to delete the calendar), and `Manage Webhooks` (for forwarding/replying).

### 2. Dynamic Image Generation Engine

*   **Current State:** The application uses a sophisticated server-side image generation system powered by **Genkit** and the **`canvas`** library.
    *   `src/ai/flows/generate-calendar-image.ts`: This flow successfully queries Firestore for events and user logs, then programmatically draws a high-fidelity calendar image.
    *   `src/ai/flows/generate-leaderboard-image.ts`: This flow queries Firestore for the top users and generates a rich leaderboard image, complete with avatars and point totals.
*   **Unified Workflow:** Both the web app and Discord bot are designed to use these generated images as the **single source of truth** for visual data. The web app pages for `/calendar` and `/leaderboard` have been refactored to simply display the output of these flows.
*   **Future Plans:**
    *   **Connect to Discord:** The Discord interaction handler needs to be updated to call these image generation flows and use the resulting base64 data URL to `PATCH` (update) the embeds, rather than using the current placeholder `picsum.photos` URLs.

### 3. Community-Wide Points & Twitch Integration

*   **Current State:** The foundation is laid.
    *   The `LeaderboardSettings` entity and configuration card on the `/leaderboard` page allow the server owner to define point values for community actions.
    *   Placeholder credentials for the Twitch API are in the `.env` file, and `tmi.js` is included as a dependency.
    *   A secure backend endpoint now exists at `/api/points/update`. It expects the `x-service-secret` header (set via `POINTS_SERVICE_SECRET`) and will increment Firestore leaderboard totals using your configured weights.
    *   The root-level `twitch-service.ts` and `startup.ts` scripts provide a lightweight service skeleton to authenticate with Twitch and forward events (or mocked events) to the web app.
*   **Vision & Future Plans:**
    *   **Unified Economy:** The goal is to create a single point system that spans both Discord and Twitch, making Firestore the master record for a user's total points.
    *   **Twitch Event Listener:** Extend `twitch-service.ts` to consume EventSub (webhooks or WebSocket) or a chat client such as `tmi.js`, then call `handleEvent` for every qualifying action.
    *   **Decentralized Earning:** This service will listen for events (follows, subs, bits, active chatting) in the channels of **all community members** (not just the server owner).
    *   **Secure API Endpoint:** The Twitch listener service (or any other integration) should call the `/api/points/update` endpoint to credit users in real-time. A mock mode is available via `MOCK_TWITCH_EVENTS=1` to exercise the flow locally without live Twitch traffic.
