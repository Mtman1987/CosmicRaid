'use server';

import { db } from '@/firebase/server-init';

/**
 * Get the global Discord bot token used by all servers
 */
export async function getGlobalBotToken(): Promise<string | null> {
  try {
    const doc = await db.collection('globalConfig').doc('discordBot').get();
    if (doc.exists) {
      return doc.data()?.token || null;
    }
    return null;
  } catch (error) {
    console.error('Failed to get global bot token:', error);
    return null;
  }
}

/**
 * Set the global Discord bot token (admin only)
 */
export async function setGlobalBotToken(token: string): Promise<void> {
  await db.collection('globalConfig').doc('discordBot').set({
    token,
    updatedAt: new Date(),
    description: 'Global Discord bot token used by all servers'
  });
}