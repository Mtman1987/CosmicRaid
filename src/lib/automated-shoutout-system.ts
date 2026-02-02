
'use server';

import { db } from "@/firebase/server-init";
import { generateAllShoutouts } from "./community-shoutout-service";
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
  console.log(`[ShoutoutCycle/${cycleId}] SIMPLIFIED: Received request for server ${serverId}.`);
  
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
    // 1. Generate a single piece of mock shoutout data. No database reads.
    console.log(`[ShoutoutCycle/${cycleId}] Step 1: Generating mock shoutout data...`);
    const mockUsersToPost = generateAllShoutouts(serverId);
    
    // 2. Post the mock data to Discord.
    console.log(`[ShoutoutCycle/${cycleId}] Step 2: Posting mock shoutout to Discord...`);
    await postAllShoutoutsToDiscord(serverId, mockUsersToPost);
    
    console.log(`[ShoutoutCycle/${cycleId}] Simplified cycle completed successfully.`);

  } catch (error) {
    console.error(`[ShoutoutCycle/${cycleId}] An error occurred:`, error);
    await serverRef.set({ lastShoutoutCycleError: (error as Error).message }, { merge: true });
  }
}
