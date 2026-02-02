'use server';

import { initializeApp, getApps, App, credential } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const apps = getApps();
let app: App;

if (!apps.length) {
  // When running in a Google Cloud environment (like App Hosting), the SDK
  // should automatically find the service account credentials from the environment.
  // We can make this explicit by using `credential.applicationDefault()`.
  // This helps prevent issues where a local GOOGLE_APPLICATION_CREDENTIALS
  // environment variable might cause errors in the deployed environment.
  app = initializeApp({
    credential: credential.applicationDefault(),
  });
} else {
  app = getApps()[0];
}

export const db = getFirestore(app);
export const auth = getAuth(app);
