
'use server';

// This is the known-good GIF URL provided by the user.
const PLACEHOLDER_GIF_URL = 'https://tenor.com/view/hello-hi-hy-hey-gif-8520159980767013609';

/**
 * This service is now in a diagnostic mode.
 * It generates a single, hardcoded mock user to test the Discord posting mechanism.
 * This function is now synchronous but must be async to be a server action.
 * It does not perform any database operations.
 */
export async function generateAllShoutouts(serverId: string): Promise<any[]> {
  console.log('[Shoutout] Generating hardcoded mock shoutout data.');

  const mockUser = {
      username: 'MockStreamer',
      group: 'Community',
      // The payload now has the GIF URL in `content` and the text in an `embed`.
      dailyShoutout: {
          content: PLACEHOLDER_GIF_URL,
          embeds: [
            {
              title: `🚀 MockStreamer is LIVE! (Test)`,
              description: `This is a test shoutout to verify the posting mechanism.`,
              url: `https://twitch.tv/MockStreamer`,
              color: 0x5865F2, // Discord Blurple
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
