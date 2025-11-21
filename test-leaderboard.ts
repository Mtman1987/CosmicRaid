import { generateLeaderboardImage } from './src/ai/flows/generate-leaderboard-image';

async function testGenerateLeaderboardImage() {
  const guildId = 'test-guild'; // Dummy guildId for testing
  console.log('Testing generateLeaderboardImage with guildId:', guildId);
  try {
    const result = await generateLeaderboardImage(guildId);
    console.log('Result:', result);
    if (result) {
      console.log('Success: Image URL returned');
    } else {
      console.log('No result: Likely due to missing API keys or service unavailability');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testGenerateLeaderboardImage();
