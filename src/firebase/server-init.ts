import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!admin.apps.length) {
  admin.initializeApp();
}

const app = admin.app();

export const db = getFirestore(app);
export const auth = getAuth(app);
