'use server';

import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const apps = getApps();
let app: App;

if (!apps.length) {
  // In a Google Cloud environment (like App Hosting), the SDK automatically
  // finds the credentials from the environment. No file is needed.
  app = initializeApp();
} else {
  app = apps[0];
}

export const db = getFirestore(app);
export const auth = getAuth(app);
