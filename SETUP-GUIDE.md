# 🚀 Cosmic Raid Setup Guide

## Overview
Cosmic Raid is a comprehensive Discord bot and web application for managing streamer communities with advanced shoutout systems, Twitch integration, and AI-powered content generation.

## 🔧 Prerequisites

### Required API Keys
1. **Twitch Developer Account**
   - Go to https://dev.twitch.tv/console
   - Create a new application
   - Get your `Client ID` and `Client Secret`

2. **FreeConvert API** (for GIF conversion)
   - Sign up at https://www.freeconvert.com/api
   - Get your API key from the dashboard

3. **Shotstack API** (backup GIF conversion)
   - Sign up at https://shotstack.io
   - Get your API key from the dashboard

4. **Google Gemini API** (for AI generation)
   - Go to https://makersuite.google.com/app/apikey
   - Create a new API key

5. **Firebase Project**
   - Create a project at https://console.firebase.google.com
   - Enable Firestore Database
   - Download service account key

## 📋 Installation Steps

### 1. Environment Setup
Copy `.env.local.example` to `.env` and fill in all required values:

```bash
# Twitch API
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret

# GIF Conversion APIs
FREE_CONVERT_API_KEY=your_freeconvert_api_key
SHOTSTACK_API_KEY=your_shotstack_api_key

# AI Generation
GEMINI_API_KEY=your_gemini_api_key

# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Discord
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_BOT_TOKEN=your_bot_token
HARDCODED_GUILD_ID=your_discord_server_id
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Health Check
```bash
npm run health-check
```
This will verify all required files and environment variables are properly configured.

### 4. Start Development Server
```bash
npm run dev
```

## 🎯 Initial Configuration

### 1. Discord Setup
1. Go to Settings page in the app
2. Enter your Discord Server ID
3. Click "Sync with Discord" to populate user data

### 2. Twitch Polling Setup
1. Navigate to Settings → Twitch Polling Settings
2. Enable "Automatic Polling"
3. Click "Poll Now" to test the connection

### 3. User Group Assignment
Users need to be assigned to groups for shoutouts to work:
- **VIP**: Premium streamers with enhanced shoutouts
- **Community**: Regular community members
- **Raid Train**: Raid train participants
- **Raid Pile**: Raid pile participants

## 🔄 How It Works

### Twitch Integration
- **Stream Monitoring**: Polls Twitch API every 5 minutes to check who's online
- **Clip Fetching**: Gets recent clips from online streamers
- **GIF Conversion**: Converts clips to GIFs for embedded shoutouts
- **Data Caching**: Stores processed data in Firebase for fast access

### Shoutout System
- **VIP Shoutouts**: Enhanced with live viewer count, game info, and GIFs
- **Community Shoutouts**: AI-generated space-themed messages
- **Raid Train/Pile**: Specialized messaging for raid events
- **Community Spotlight**: Rotating clips from online community members

### AI Generation
- Uses Google Gemini to create personalized shoutout messages
- Space-themed personality with cosmic terminology
- Real-time data integration (game, viewers, stream title)

## 🚨 Troubleshooting

### Common Issues

**Shoutouts not generating:**
- Check Twitch API credentials in .env
- Verify users have correct group assignments
- Ensure polling service is running

**GIF conversion failing:**
- Verify FreeConvert API key is valid
- Check Shotstack API as backup
- Monitor API usage limits

**Firebase connection issues:**
- Verify service account key path
- Check Firestore security rules
- Ensure project ID matches

**Polling service not starting:**
- Check server logs for errors
- Verify HARDCODED_GUILD_ID is set
- Restart the application

### Debug Steps
1. Run `npm run health-check` to identify issues
2. Check browser console for client-side errors
3. Monitor server logs for API failures
4. Test individual components in Settings page

## 🎮 Features

### Dashboard
- Real-time community statistics
- Recent shoutout history
- Upcoming events calendar

### Shoutouts
- **VIP Shoutouts**: Premium streamers with live data and GIFs
- **Community Shoutouts**: AI-generated messages for all members
- **Group-specific**: Raid Train and Raid Pile specialized content
- **Community Spotlight**: Rotating featured clips

### Settings
- Discord integration management
- Twitch polling controls
- User role administration
- Developer tools and testing

### Calendar
- Event scheduling and management
- AI-generated calendar images
- Discord integration for announcements

### Leaderboard
- Points system for community engagement
- Twitch event tracking (raids, follows, subs)
- Customizable point values

## 🔮 Advanced Configuration

### Custom Point Values
Modify point awards in Settings → Points Configuration:
- Raids: Default 100 points
- Follows: Default 10 points
- Subscriptions: Default 50 points
- Chat activity: Default 1 point

### Polling Intervals
Default is 5 minutes. To modify, edit `POLL_INTERVAL_MS` in `src/lib/polling-service.ts`

### GIF Cache Duration
Default is 24 hours. Modify `GIF_CACHE_DURATION_MS` in polling service.

## 📊 Monitoring

### Health Checks
- Run `npm run health-check` regularly
- Monitor API usage limits
- Check Firebase storage usage
- Verify Discord bot permissions

### Performance
- GIF conversion can be slow (2-10 seconds per clip)
- Polling service uses minimal resources
- Firebase reads scale with community size

## 🚀 Production Deployment

### Environment Variables
Ensure all production API keys are set and have sufficient quotas.

### Firebase Security
Configure Firestore security rules for production use.

### Monitoring
Set up logging and monitoring for API failures and performance issues.

### Backup
Regular Firebase backups recommended for user data and configurations.

## 🆘 Support

If you encounter issues:
1. Run the health check script
2. Check the troubleshooting section
3. Review server and browser logs
4. Verify all API keys and permissions

The system is designed to be resilient with fallbacks for most failures, but proper configuration is essential for optimal performance.
