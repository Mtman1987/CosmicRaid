/**
 * Debug endpoint to see ALL environment variables
 */

export async function GET() {
  // Only show this in production temporarily for debugging
  const allEnvVars = Object.keys(process.env).reduce((acc, key) => {
    // Show first 20 chars of each value
    const value = process.env[key] || '';
    acc[key] = value.substring(0, 20) + (value.length > 20 ? '...' : '');
    return acc;
  }, {} as Record<string, string>);

  return Response.json({
    timestamp: new Date().toISOString(),
    count: Object.keys(allEnvVars).length,
    variables: allEnvVars,
    // Specifically check our secrets
    hasAppHostingSecrets: {
      TWITCH_CLIENT_ID: !!process.env.TWITCH_CLIENT_ID,
      DISCORD_BOT_TOKEN: !!process.env.DISCORD_BOT_TOKEN,
      FREE_CONVERT_API_KEY: !!process.env.FREE_CONVERT_API_KEY,
    }
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    }
  });
}
