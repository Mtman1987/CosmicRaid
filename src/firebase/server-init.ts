import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// This file is for server-side initialization of the Firebase Admin SDK.
// It should only be imported in server-side files (e.g., server actions, API routes).

if (!admin.apps.length) {
  // In a Google Cloud environment (like App Hosting), the SDK automatically
  // finds the credentials from the environment. No explicit configuration is needed.
  admin.initializeApp();
}

// Export the initialized services from the default app instance.
export const db = getFirestore();
export const auth = getAuth();
