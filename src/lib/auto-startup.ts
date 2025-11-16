'use server';

import { loadSecrets } from './secret-loader';

let isInitialized = false;

export async function initializeServices() {
  if (isInitialized) {
    console.log('[AutoStartup] Services already initialized');
    return;
  }

  try {
    console.log('[AutoStartup] Initializing services on app startup...');
    
    // Load secrets first
    await loadSecrets();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/startup`, {
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