import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// This file is for server-side initialization of the Firebase Admin SDK.
// It should only be imported in server-side files (e.g., server actions, API routes).

if (!admin.apps.length) {
  // Explicitly initialize with the project ID from the environment.
  // This helps the SDK find the correct credentials in the App Hosting environment.
  admin.initializeApp({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
  });
}

// Export the initialized services from the default app instance.
export const db = getFirestore();
export const auth = getAuth();
