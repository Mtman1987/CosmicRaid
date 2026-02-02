
'use server';

// This is a known-good, direct GIF link from Giphy.
// Direct links are more reliable for Discord embeds than page links from sites like Tenor or broken Imgur links.
const PLACEHOLDER_GIF_URL = 'https://firebasestorage.googleapis.com/v0/b/studio-9468926194-e03ac.firebasestorage.app/o/fulldance-ezgif.com-resize.gif?alt=media&token=87ff1ee3-f791-4330-8b16-4813b4f7e8e9';

/**
 * This service is now in a diagnostic mode.
 * It generates a single, hardcoded mock user to test the core Discord posting logic.
 * It does not perform any database operations.
 */
export async function generateAllShoutouts(serverId: string): Promise<any[]> {
  console.log('[Shoutout] Generating hardcoded mock shoutout data.');

  const mockUser = {
      username: 'MockStreamer',
      group: 'Community',
      // The payload now has the GIF URL inside the embed's image object.
      dailyShoutout: {
          embeds: [
            {
              title: `🚀 MockStreamer is LIVE! (Test)`,
              description: `This is a test shoutout to verify the posting mechanism.`,
              url: `https://twitch.tv/MockStreamer`,
              color: 0x5865F2, // Discord Blurple
              image: {
                url: PLACEHOLDER_GIF_URL,
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
