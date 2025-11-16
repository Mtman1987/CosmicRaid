/**
 * Helpers to understand when we're running inside Firebase App Hosting / Cloud Run
 * where headless Chrome and FFmpeg aren't available.
 */
export function isAppHostingEnvironment(): boolean {
  return Boolean(
    process.env.K_SERVICE ||
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.APP_HOSTING ||
      process.env.FIREBASE_APP_HOSTING
  );
}

export function isPuppeteerDisabled(): boolean {
  return isAppHostingEnvironment() || process.env.DISABLE_PUPPETEER === 'true';
}

export function isFfmpegDisabled(): boolean {
  return isAppHostingEnvironment() || process.env.DISABLE_FFMPEG === 'true';
}
