'use server';

import { db } from "@/firebase/server-init";
import { manualPoll } from "./polling-service";
import { generateAllShoutouts } from "./community-shoutout-service";
import { updateCommunitySpotlight } from "./community-spotlight-service";
import { postAllShoutoutsToDiscord } from "./discord-bot-service";

const SHOUTOUT_CYCLE_COOLDOWN_MS = 4 * 60 * 1000; // 4 minutes to be safe with a 5-min cron

async function canRunCycle(serverId: string): Promise<boolean> {
  const serverRef = db.collection('servers').doc(serverId);
  const doc = await serverRef.get();
  
  if (!doc.exists) {
    return true; // First time running
  }

  const lastRun = doc.data()?.lastShoutoutCycle?.toDate();
  if (!lastRun) {
    return true;
  }

  const elapsed = Date.now() - lastRun.getTime();
  return elapsed > SHOUTOUT_CYCLE_COOLDOWN_MS;
}

export async function runAutomatedShoutoutCycle(serverId: string, options: { force?: boolean } = {}): Promise<void> {
  const cycleId = Date.now();
  console.log(`[ShoutoutCycle/${cycleId}] Received request for server ${serverId}. Force: ${!!options.force}`);
  
  if (!options.force) {
    const canRun = await canRunCycle(serverId);
    if (!canRun) {
      console.log(`[ShoutoutCycle/${cycleId}] Cooldown active. Skipping.`);
      return;
    }
  }

  const serverRef = db.collection('servers').doc(serverId);
  await serverRef.set({ lastShoutoutCycle: new Date() }, { merge: true });

  try {
    // 1. Poll Twitch for latest online statuses
    console.log(`[ShoutoutCycle/${cycleId}] Step 1: Polling Twitch for online statuses...`);
    await manualPoll(serverId);
    
    // 2. Generate new shoutout content (images, embeds) for all online users
    console.log(`[ShoutoutCycle/${cycleId}] Step 2: Generating shoutout content...`);
    await generateAllShoutouts(serverId);
    
    // 3. Update the community spotlight to pick a new random user
    console.log(`[ShoutoutCycle/${cycleId}] Step 3: Updating community spotlight...`);
    await updateCommunitySpotlight(serverId);
    
    // 4. Post everything to Discord
    console.log(`[ShoutoutCycle/${cycleId}] Step 4: Posting all shoutouts to Discord...`);
    await postAllShoutoutsToDiscord(serverId);
    
    console.log(`[ShoutoutCycle/${cycleId}] Cycle completed successfully.`);

  } catch (error) {
    console.error(`[ShoutoutCycle/${cycleId}] An error occurred:`, error);
    // Optionally update Firestore with error state
    await serverRef.set({ lastShoutoutCycleError: (error as Error).message }, { merge: true });
  }
}
