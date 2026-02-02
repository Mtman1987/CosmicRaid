# 🚀 Cosmic Raid - Firebase Studio Project

A comprehensive Discord bot and web application for managing streamer communities with advanced shoutout systems, Twitch integration, and AI-powered content generation. Features real-time stream monitoring, GIF conversion, and automated community engagement.

## 🚀 Quick Start

1.  **Install Dependencies:** `npm install`
2.  **Configure Environment:** Copy `.env.local.example` to `.env` and fill in all the required API keys.
    - See the **[SETUP-GUIDE.md](SETUP-GUIDE.md)** for a complete list of keys and where to find them.
3.  **Check Configuration:** Run `npm run health-check` to verify your setup.
4.  **Run the App:** `npm run dev`
5.  **Initial Data Sync:** Open the app, go to the `/settings` page, and click "Sync with Discord" to populate your database.

---

## 📖 Documentation

- **[SETUP-GUIDE.md](SETUP-GUIDE.md)**: A complete, step-by-step guide to installing the app, configuring all API keys, and getting started. **Start here!**
- **[SERVER-SIDE-FALLBACK.md](SERVER-SIDE-FALLBACK.md)**: Detailed explanation of the server-side GIF generation fallback system.
- **[CLOUD-DEPLOYMENT.md](CLOUD-DEPLOYMENT.md)**: Instructions for deploying the application to Firebase App Hosting.

---

## 🛠️ Key Features

- **Automated Shoutouts**: Real-time stream monitoring and AI-powered shoutout messages.
- **Dynamic Content**: Server-side generation of GIFs and images for rich Discord embeds.
- **Community Engagement**: Points system, leaderboards, and a shared event calendar.
- **Developer Friendly**: Includes a health-check script to verify your local setup.
