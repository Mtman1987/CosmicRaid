const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3300;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'cosmic-raid-local-services',
    timestamp: new Date().toISOString(),
    puppeteer: 'available',
    ffmpeg: 'available'
  });
});

// Screenshot endpoint
app.post('/api/screenshot', async (req, res) => {
  try {
    const { url, width = 1280, height = 660, waitFor = 3000 } = req.body;
    
    // Import puppeteer dynamically
    const puppeteer = require('puppeteer');
    
    const browser = await puppeteer.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width, height });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.waitForTimeout(waitFor);
    
    const screenshot = await page.screenshot({ 
      type: 'png',
      fullPage: false
    });
    
    await browser.close();
    
    const dataUrl = `data:image/png;base64,${screenshot.toString('base64')}`;
    
    res.json({
      success: true,
      dataUrl,
      width,
      height
    });
    
  } catch (error) {
    console.error('Screenshot error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GIF conversion endpoint
app.post('/convert-gif', (req, res) => {
  res.json({
    success: false,
    error: 'GIF conversion not implemented in minimal service'
  });
});

app.listen(port, () => {
  console.log(`🚀 Local services running on port ${port}`);
  console.log(`📸 Screenshot endpoint: http://localhost:${port}/api/screenshot`);
  console.log(`❤️  Health check: http://localhost:${port}/health`);
});