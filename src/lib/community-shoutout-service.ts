
'use server';

const PLACEHOLDER_GIF = 'https://media.tenor.com/yG_mD8bW32EAAAAd/star-wars-celebration-lightsaber.gif';

export interface ShoutoutResult {
  streamerName: string;
  success: boolean;
  message: string;
}

/**
 * Generates a single, hardcoded mock user profile with a shoutout embed.
 * This function is synchronous in its logic but declared async to satisfy
 * Server Action requirements. It does not perform any database operations.
 * It's used for testing the core Discord posting logic without external dependencies.
 */
export async function generateAllShoutouts(serverId: string): Promise<any[]> {
  console.log('[Shoutout] Generating hardcoded mock shoutout data.');

  const mockUser = {
    username: 'MockStreamer',
    group: 'Community',
    dailyShoutout: {
      embeds: [
        {
          title: `🚀 MockStreamer is LIVE! (Test)`,
          description: `This is a test shoutout to verify the posting mechanism.`,
          url: `https://twitch.tv/MockStreamer`,
          color: 0x5865f2, // Discord Blurple
          image: {
            url: PLACEHOLDER_GIF,
          },
          footer: {
            text: 'Cosmic Raid Mock Shoutout',
          },
          timestamp: new Date().toISOString(),
        },
      ],
    },
  };

  return [mockUser];
}
