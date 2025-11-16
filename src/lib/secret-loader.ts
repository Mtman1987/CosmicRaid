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

    // List of secrets to load (add your secret names here)
    const secretNames = [
      'DISCORD_BOT_TOKEN',
      'DISCORD_CLIENT_ID', 
      'DISCORD_CLIENT_SECRET',
      'TWITCH_CLIENT_ID',
      'TWITCH_CLIENT_SECRET',
      'FIREBASE_ADMIN_KEY',
      // Add other secret names as needed
    ];

    console.log(`Loading ${secretNames.length} secrets from Secret Manager...`);

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