const HOSTED_FALLBACK = 'https://cosmicraid--studio-9468926194-e03ac.us-central1.hosted.app';

let cachedBaseUrl: string | null = null;
let lastFetch = 0;
const CACHE_TTL = 60_000; // 1 minute

export async function getBaseUrl(serverId?: string): Promise<string> {
  if (cachedBaseUrl && Date.now() - lastFetch < CACHE_TTL) {
    return cachedBaseUrl;
  }

  try {
    const { db } = await import('@/firebase/server-init');

    // Global config (top-level): globalConfig/ngrok BASE_URL
    const ngrokDoc = await db.collection('globalConfig').doc('ngrok').get();
    const ngrokUrl = ngrokDoc.exists ? ngrokDoc.data()?.BASE_URL : undefined;
    if (ngrokUrl) {
      cachedBaseUrl = String(ngrokUrl).replace(/\/$/, '');
      lastFetch = Date.now();
      return cachedBaseUrl;
    }
  } catch (err) {
    // Silent fallback to hardcoded
    console.warn('[BaseUrl] Failed to load from Firestore:', err instanceof Error ? err.message : err);
  }

  cachedBaseUrl = HOSTED_FALLBACK.replace(/\/$/, '');
  lastFetch = Date.now();
  return cachedBaseUrl;
}
