'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const apps = getApps();
let app: App;

if (!apps.length) {
  // In a Google Cloud environment, the SDK will automatically find credentials.
  app = initializeApp();
} else {
  app = apps[0];
}

export const db = getFirestore(app);
export const auth = getAuth(app);
