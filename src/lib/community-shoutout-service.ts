
'use server';

// A more reliable, direct link to a GIF file that Discord can embed.
const PLACEHOLDER_GIF = 'https://media.giphy.com/media/3o84sCE6KjEPpXG3zG/giphy.gif';

/**
 * This service is now in a diagnostic mode.
 * It generates a single, hardcoded mock user to test the Discord posting mechanism.
 * This function is now synchronous and does not perform any database operations.
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
      }
  };

  return [mockUser];
}
