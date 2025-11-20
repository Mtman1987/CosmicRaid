'use server';

let isInitialized = false;

export async function initializeServices() {
  if (isInitialized) {
    console.log('[AutoStartup] Services already initialized');
    return;
  }

  try {
    console.log('[AutoStartup] Initializing services on app startup...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const appUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';

    const response = await fetch(`${appUrl}/api/startup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      isInitialized = true;
      console.log('[AutoStartup] Services initialized successfully');
    } else {
      console.error('[AutoStartup] Failed to initialize services:', await response.text());
    }
  } catch (error) {
    console.error('[AutoStartup] Error during initialization:', error);
  }
}

// Auto-initialize disabled - services start manually via /api/startup
// if (typeof window === 'undefined') { // Server-side only
//   setTimeout(() => {
//     initializeServices();
//   }, 5000); // 5 second delay to ensure app is ready
// }
