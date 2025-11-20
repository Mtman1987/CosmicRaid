# 🚀 Puppeteer Service with ngrok Tunnel

This setup allows your App Hosting deployment to access your local Puppeteer/FFmpeg service through an ngrok tunnel.

## How It Works

When you run the Electron app (or manually start services), it automatically:

1. **Starts ngrok tunnel** - Creates a public HTTPS URL pointing to `localhost:3300`
2. **Gets the ngrok URL** - Fetches the public URL from ngrok's local API
3. **Uploads to Firestore** - Stores the URL as `PUPPETEER_SERVICE_URL` secret
4. **Starts Puppeteer service** - Launches the dev server with Puppeteer/FFmpeg on port 3300
5. **Cleans up on exit** - Removes the URL from Firestore when you quit

Your App Hosting deployment will automatically use this tunnel URL when generating shoutout GIFs/videos!

## Running the Services

### Option 1: Electron App (Recommended)
```bash
npm run electron
```
The app runs in your system tray and handles everything automatically.

### Option 2: Manual Start
```bash
npm run start:services
```
Runs the startup script directly in your terminal.

### Option 3: Direct Script
```bash
node startup.js
```

## What Gets Logged

The Electron dashboard shows:
- `[Startup]` - ngrok and service initialization
- `[ngrok]` - ngrok tunnel status
- `[OUT]` - Dev server output
- `[ERR]` - Any errors
- `[SYS]` - System events (start/stop)

## Requirements

- **ngrok** installed and authenticated (you have ngrok paid through Apollo Station)
- **Firebase Admin SDK** initialized
- Port **3300** available for the dev server
- Port **4040** available for ngrok's local API

## Firestore Secret

The service automatically manages this secret:

```javascript
// secrets/PUPPETEER_SERVICE_URL
{
  value: "https://abc123.ngrok.io",
  updatedAt: <timestamp>,
  description: "ngrok tunnel URL to access local Puppeteer/FFmpeg service from App Hosting"
}
```

## Fallback Behavior

If your local service isn't running:
- App Hosting detects no `PUPPETEER_SERVICE_URL` in Firestore
- Falls back to Twitch clips + FreeConvert API
- Falls back to text-only shoutouts if all else fails

## Manual Management

If you need to manually manage the tunnel URL:

```bash
# Add a custom URL
node add-puppeteer-tunnel.js https://your-custom-url.ngrok.io

# Remove the URL (force fallback to Twitch clips)
node add-puppeteer-tunnel.js REMOVE
```

## Troubleshooting

**"Failed to connect to ngrok API"**
- Make sure ngrok is running: `ngrok http 3300`
- Check if port 4040 is available

**"No HTTPS tunnel found"**
- ngrok might still be starting up
- Check ngrok dashboard: http://localhost:4040

**App Hosting still not using tunnel**
- Check Firestore: `secrets/PUPPETEER_SERVICE_URL` should exist
- Redeploy App Hosting to pick up the new secret
- Check App Hosting logs for "Using tunneled service URL"

## Security Notes

- The ngrok URL is only stored while your service is running
- It's automatically removed when you quit the app
- Your ngrok paid account keeps the tunnel stable
- The service account key is required for Firestore access
