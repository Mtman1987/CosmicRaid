import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { isAppHostingEnvironment } from './runtime-env';

let secretsLoaded = false;
const secretCache = new Map<string, string>();

export async function loadSecrets() {
  if (secretsLoaded || !isAppHostingEnvironment()) {
    return;
  }

  try {
    const client = new SecretManagerServiceClient();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    
    if (!projectId) {
      console.log('No GOOGLE_CLOUD_PROJECT found, skipping secret loading');
      return;
    }

    // Load all secrets from your apphosting.yaml
    const secretNames = [
      'BOT_SECRET_KEY', 'CLOUDE_API_KEY', 'DISCORD_APP_ID', 'DISCORD_BOT_TOKEN',
      'DISCORD_CALENDAR_CHANNEL_ID', 'DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET',
      'DISCORD_ID', 'DISCORD_INVITE_URL', 'DISCORD_LEADERBOARD_CHANNEL_ID',
      'DISCORD_PUBLIC_KEY', 'DISCORD_RAID_PILE_CHANNEL_ID', 'DISCORD_RAID_TRAIN_CHANNEL_ID',
      'DISCORD_SHOUTOUT_CHANNEL_ID', 'DISCORD_VIP_CHANNEL_ID', 'DISCORD_WEBHOOK_URL',
      'EMERGENCY_SLOTS_LOOKAHEAD_HOURS', 'EMERGENCY_SLOT_COST', 'FREE_CONVERT_API_KEY',
      'GEMINI_API_KEY', 'GOOGLE_APPLICATION_CREDENTIALS', 'GUILD_ID',
      'HARDCODED_ADMIN_DISCORD_ID', 'HARDCODED_ADMIN_TWITCH_ID', 'HARDCODED_GUILD_ID',
      'NEXT_PUBLIC_BASE_URL', 'TWITCH_CLIENT_ID', 'TWITCH_CLIENT_SECRET',
      'TWITCH_BOT_TOKEN', 'TWITCH_BROADCASTER_ID', 'TWITCH_EVENTSUB_SECRET'
      // Add more as needed
    ];

    console.log(`Loading ${secretNames.length} critical secrets from Secret Manager...`);

    for (const secretName of secretNames) {
      try {
        const [version] = await client.accessSecretVersion({
          name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
        });

        const secretValue = version.payload?.data?.toString();
        if (secretValue) {
          process.env[secretName] = secretValue;
          secretCache.set(secretName, secretValue);
        }
      } catch (error) {
        console.log(`Failed to load secret ${secretName}:`, error.message);
      }
    }

    secretsLoaded = true;
    console.log('✅ Secrets loaded from Secret Manager');
  } catch (error) {
    console.error('Failed to load secrets:', error);
  }
}

export function getSecret(name: string): string | undefined {
  return secretCache.get(name) || process.env[name];
}