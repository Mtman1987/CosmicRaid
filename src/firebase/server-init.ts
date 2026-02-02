'use server';

import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let db: Firestore;
let auth: Auth;

try {
  if (!admin.apps.length) {
    console.log('[Firebase Admin] Initializing SDK...');
    
    // In a deployed Google Cloud environment (like App Hosting),
    // the GOOGLE_CLOUD_PROJECT env var is automatically set.
    // The SDK will use this and Application Default Credentials.
    const projectId = process.env.GOOGLE_CLOUD_PROJECT;
    if (projectId) {
      console.log(`[Firebase Admin] Using project ID from environment: ${projectId}`);
      admin.initializeApp({
        projectId: projectId,
      });
    } else {
      // Fallback for local development or other environments.
      // This may not work in the deployed environment if credentials aren't set up.
      console.warn('[Firebase Admin] GOOGLE_CLOUD_PROJECT not found. Attempting default initialization.');
      admin.initializeApp();
    }
    console.log('[Firebase Admin] SDK initialized successfully.');
  }
  
  db = getFirestore();
  auth = getAuth();

} catch (error) {
  console.error('[Firebase Admin] CRITICAL: SDK initialization failed.', error);
  // Create dummy objects to prevent the app from crashing on import,
  // though any calls to them will fail, surfacing the error clearly.
  db = {} as Firestore;
  auth = {} as Auth;
}

export { db, auth };
