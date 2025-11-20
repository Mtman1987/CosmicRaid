const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin from environment
let bucket;
try {
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (serviceAccountBase64) {
    const serviceAccount = JSON.parse(Buffer.from(serviceAccountBase64, 'base64').toString());
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    });
    bucket = admin.storage().bucket();
    console.log('✅ Firebase initialized from environment');
  } else {
    console.log('ℹ️ Firebase not configured - will return base64 fallback');
  }
} catch (error) {
  console.log('ℹ️ Firebase initialization failed - will return base64 fallback:', error.message);
}

const app = express();
const port = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cosmic-raid-local-services',
    timestamp: new Date().toISOString(),
    puppeteer: 'available',
    ffmpeg: 'available',
  });
});

// Screenshot endpoint
app.post('/api/screenshot', async (req, res) => {
  try {
    const { url, width = 1280, height = 660, waitFor = 3000 } = req.body;

    const puppeteer = require('puppeteer');

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await new Promise((resolve) => setTimeout(resolve, waitFor));

    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    });

    await browser.close();

    // Try Firebase Storage first, fallback to base64
    if (bucket) {
      try {
        const fileName = `calendar-images/local-service/calendar-${Date.now()}.png`;
        const file = bucket.file(fileName);

        await file.save(screenshot, {
          metadata: { contentType: 'image/png' },
          public: true,
        });

        const publicUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${fileName}`;

        res.json({
          success: true,
          imageUrl: publicUrl,
          width,
          height,
        });
        return;
      } catch (error) {
        console.error('Firebase upload failed, falling back to base64:', error.message);
      }
    }

    // Fallback to base64
    const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`;

    res.json({
      success: true,
      dataUrl,
      width,
      height,
    });
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GIF conversion endpoint
app.post('/convert-gif', (req, res) => {
  res.json({
    success: false,
    error: 'GIF conversion not implemented in minimal service',
  });
});

// Heartbeat endpoint for cloud app to ping
app.get('/heartbeat', (req, res) => {
  console.log(`❤️ Heartbeat received from cloud app: ${new Date().toLocaleTimeString()}`);
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    message: 'Local services responding to cloud app heartbeat',
  });
});

// Optional ping back to hosted app to keep it warm (set HOSTED_PING_URL)
const hostedPingUrl = process.env.HOSTED_PING_URL;
if (hostedPingUrl) {
  const intervalMs = Number(process.env.HOSTED_PING_INTERVAL_MS || 240000); // 4 minutes default
  const pingHosted = async () => {
    try {
      const resp = await fetch(hostedPingUrl, { method: 'GET', cache: 'no-store' });
      if (!resp.ok) {
        console.warn('[HostedPing] Non-200 response:', resp.status);
      }
    } catch (err) {
      console.warn('[HostedPing] Failed:', err?.message || err);
    }
  };
  setInterval(pingHosted, intervalMs);
  pingHosted();
  console.log(`[HostedPing] Enabled -> ${hostedPingUrl} every ${intervalMs}ms`);
}

app.listen(port, () => {
  console.log(`🚀 Local services running on port ${port}`);
  console.log(`🖼️ Screenshot endpoint: http://localhost:${port}/api/screenshot`);
  console.log(`✅ Health check: http://localhost:${port}/health`);
  console.log(`❤️ Heartbeat endpoint: http://localhost:${port}/heartbeat`);
});
