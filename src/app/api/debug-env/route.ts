export async function GET() {
  return Response.json({
    hasDiscordToken: !!process.env.DISCORD_BOT_TOKEN,
    tokenLength: process.env.DISCORD_BOT_TOKEN?.length || 0,
    nodeEnv: process.env.NODE_ENV,
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('DISCORD')).sort()
  });
}