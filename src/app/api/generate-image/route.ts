import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Only run in local Electron mode
  if (!process.env.ELECTRON_MODE) {
    return NextResponse.json({ error: 'Not available in hosted mode' }, { status: 404 });
  }

  try {
    const { username, contentType } = await request.json();
    
    // Use local conversion service for screenshots
    const localServiceUrl = process.env.LOCAL_CONVERSION_SERVICE_URL;
    if (!localServiceUrl) {
      return NextResponse.json({ error: 'Local service not configured' }, { status: 503 });
    }
    
    let screenshotUrl: string;
    
    switch (contentType) {
      case 'calendar':
        screenshotUrl = `http://localhost:3300/headless/calendar`;
        break;
      case 'leaderboard':
        screenshotUrl = `http://localhost:3300/headless/leaderboard`;
        break;
      default:
        screenshotUrl = `https://twitch.tv/${username}`;
    }
    
    const response = await fetch(`${localServiceUrl}/api/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        url: screenshotUrl,
        width: 1920,
        height: 1080
      })
    });
    
    if (!response.ok) {
      throw new Error(`Screenshot service failed: ${response.status}`);
    }
    
    const { dataUrl } = await response.json();
    const base64Data = dataUrl.split(',')[1];
    const screenshot = Buffer.from(base64Data, 'base64');
    
    // Upload to Firebase Storage
    const { uploadToStorage } = await import('@/lib/firebase-storage-service');
    const storagePath = `images/${username}_${contentType}_${Date.now()}.png`;
    const imageUrl = await uploadToStorage(screenshot, storagePath, 'image/png');
    
    return NextResponse.json({ imageUrl });
    
  } catch (error) {
    console.error('Local image generation error:', error);
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 });
  }
}