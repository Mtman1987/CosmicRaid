'use server';

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!admin.apps.length) {
  // In a Google Cloud environment (like App Hosting), the SDK automatically
  // finds credentials from the environment. Calling initializeApp() with no
  // arguments is the correct way to do this. This prevents the SDK from
  // trying to load local file paths that don't exist in the cloud.
  admin.initializeApp();
}

const app = admin.app();

export const db = getFirestore(app);
export const auth = getAuth(app);
