
'use server'

import { db } from "@/firebase/server-init"
import { FieldValue } from "firebase-admin/firestore"

const PLACEHOLDER_GIF = 'https://media.tenor.com/yG_mD8bW32EAAAAd/star-wars-celebration-lightsaber.gif';

export interface ShoutoutResult {
  streamerName: string
  success: boolean
  message: string
}

export async function generateAllShoutouts(serverId: string): Promise<ShoutoutResult[]> {
  const usersRef = db.collection('servers').doc(serverId).collection('users')
  const snapshot = await usersRef.where('isOnline', '==', true).get()

  if (snapshot.empty) {
    console.log('No online users found to generate shoutouts for.')
    return [
      {
        streamerName: 'N/A',
        success: true,
        message: 'No online users found. Nothing to do!',
      },
    ]
  }

  const results: ShoutoutResult[] = []
  const batch = db.batch()

  for (const doc of snapshot.docs) {
    const user = doc.data()
    const streamerName = user.username

    try {
      console.log(`[Shoutout] SIMPLIFIED: Processing user ${streamerName}`)

      // Create a very simple, static shoutout object.
      const shoutoutData = {
        embeds: [
          {
            title: `🚀 ${streamerName} is LIVE!`,
            description: `Join ${streamerName}'s stream now for some awesome content!`,
            url: `https://twitch.tv/${streamerName}`,
            color: 5814783, // A nice blue
            image: {
              url: PLACEHOLDER_GIF,
            },
            footer: {
              text: 'Cosmic Raid Shoutout System',
            },
            timestamp: new Date().toISOString(),
          },
        ],
      }

      // Add the generated shoutout to the user's document in the batch update
      const updateData = {
        dailyShoutout: shoutoutData,
        shoutoutGeneratedAt: FieldValue.serverTimestamp(),
      }
      
      batch.update(doc.ref, updateData)

      results.push({
        streamerName,
        success: true,
        message: 'Simplified shoutout generated successfully.',
      })
    } catch (error) {
      console.error(`Failed to generate simplified shoutout for ${streamerName}:`, error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      results.push({
        streamerName,
        success: false,
        message: `Failed: ${errorMessage}`,
      })
    }
  }

  // Commit all the updates at once
  await batch.commit()
  console.log('Simplified batch update of shoutouts completed.')

  return results
}
