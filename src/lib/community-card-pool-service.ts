"use server";

import { db } from '@/firebase/server-init';
import type { DocumentReference, DocumentSnapshot } from 'firebase-admin/firestore';

interface CommunityCardRecord {
  imageUrl: string;
  title: string;
  game: string;
  createdAt: Date;
}

type UserLookup = { userId?: string; username?: string };

const CARD_POOL_LIMIT = 5;
const CARD_TTL_MS = 30 * 60 * 1000; // 30 minutes

async function resolveUserDoc(
  serverId: string,
  lookup: UserLookup
): Promise<{ ref: DocumentReference | null; snapshot: DocumentSnapshot | null }> {
  const usersRef = db.collection('servers').doc(serverId).collection('users');

  const tryDoc = async (docId?: string) => {
    if (!docId) return null;
    const ref = usersRef.doc(docId);
    const snap = await ref.get();
    return snap.exists ? { ref, snapshot: snap } : null;
  };

  const direct = await tryDoc(lookup.userId ?? lookup.username);
  if (direct) return direct;

  if (lookup.username) {
    const usernameLower = lookup.username.toLowerCase();
    const byExact = await usersRef.where('username', '==', lookup.username).limit(1).get();
    if (!byExact.empty) {
      const snap = byExact.docs[0];
      return { ref: snap.ref, snapshot: snap };
    }
    const byLower = await usersRef.where('usernameLower', '==', usernameLower).limit(1).get();
    if (!byLower.empty) {
      const snap = byLower.docs[0];
      return { ref: snap.ref, snapshot: snap };
    }
  }

  console.warn(
    `[CommunityCardPool] Unable to resolve user doc for ${lookup.username ?? lookup.userId} in server ${serverId}`
  );
  return { ref: null, snapshot: null };
}



function normalizeDate(date: any): Date | null {
  if (!date) return null;
  if (date instanceof Date) return date;
  if (typeof date.toDate === 'function') return date.toDate();
  const parsed = new Date(date);
  return isNaN(parsed.getTime()) ? null : parsed;
}

export async function getReusableCommunityCard(
  serverId: string,
  lookup: UserLookup,
  title: string,
  game: string
): Promise<CommunityCardRecord | null> {
  try {
    const { snapshot } = await resolveUserDoc(serverId, lookup);
    if (!snapshot?.exists) return null;

    const records: CommunityCardRecord[] = snapshot.data()?.communityCards || [];
    const now = Date.now();

    const matchingCard = records.find(card => {
      const created = normalizeDate(card.createdAt);
      if (!created) return false;
      return (
        card.title === title &&
        card.game === game &&
        now - created.getTime() < CARD_TTL_MS
      );
    });

    return matchingCard || null;
  } catch (error) {
    console.error(`[CommunityCardPool] Failed to fetch card for ${lookup.username ?? lookup.userId}:`, error);
    return null;
  }
}

export async function addCommunityCardToPool(
  serverId: string,
  lookup: UserLookup,
  card: { imageUrl: string; title: string; game: string }
): Promise<void> {
  try {
    const { ref: userRef, snapshot } = await resolveUserDoc(serverId, lookup);
    if (!userRef || !snapshot?.exists) return;

    const records: CommunityCardRecord[] = snapshot.data()?.communityCards || [];
    const newRecord: CommunityCardRecord = {
      ...card,
      createdAt: new Date()
    };

    const normalizedRecords = records
      .map(record => ({
        ...record,
        createdAt: normalizeDate(record.createdAt) || new Date(0)
      }))
      .filter(record => Date.now() - record.createdAt.getTime() < CARD_TTL_MS);

    const updatedRecords = [...normalizedRecords, newRecord].slice(-CARD_POOL_LIMIT);

    await userRef.update({
      communityCards: updatedRecords,
      lastCommunityCardUpdate: new Date()
    });
  } catch (error) {
    console.error(`[CommunityCardPool] Failed to add card for ${lookup.username ?? lookup.userId}:`, error);
  }
}
