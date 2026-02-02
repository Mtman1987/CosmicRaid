'use server';

import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

if (!admin.apps.length) {
  // When running in a Google Cloud environment (like App Hosting), the SDK
  // should automatically find the service account credentials from the environment.
  // We can make this explicit by using `credential.applicationDefault()`.
  // This helps prevent issues where a local GOOGLE_APPLICATION_CREDENTIALS
  // environment variable might cause errors in the deployed environment.
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const app = admin.app();

export const db = getFirestore(app);
export const auth = getAuth(app);
