'use server';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// This file is for server-side initialization of the Firebase Admin SDK.
// It should only be imported in server-side files (e.g., server actions, API routes).

if (!admin.apps.length) {
  // In some build environments, a local GOOGLE_APPLICATION_CREDENTIALS
  // from a developer's machine can leak into the server environment,
  // causing the Admin SDK to fail authentication.
  // By deleting it, we force the SDK to rely on the default credentials
  // provided by the Google Cloud runtime (like App Hosting), which is the correct behavior.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log('[Firebase Admin] Unsetting GOOGLE_APPLICATION_CREDENTIALS to use runtime credentials.');
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  }
  
  admin.initializeApp();
}

// Export the initialized services from the default app instance.
export const db = getFirestore();
export const auth = getAuth();
