export async function generateRaidTrainShoutout(input: { forceUsername?: string } = {}) {
  // Simple template-based raid train shoutout generation
  const targetUsername = input.forceUsername;
  
  if (!targetUsername) {
    return {
      shoutout: "🚂 All aboard the Space Mountain Express! The current time slot is open - any brave Captain ready to join the raid train? Sign up for your adventure through the cosmos!",
      hasScheduledUser: false
    };
  }

  const shoutout = `🚂 Next stop on the Space Mountain Express: Captain ${targetUsername}'s stellar station! All passengers, prepare for departure to twitch.tv/${targetUsername}!`;
  
  return {
    shoutout,
    username: targetUsername,
    hasScheduledUser: true
  };
}