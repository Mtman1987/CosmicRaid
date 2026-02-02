'use server';

import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp;
let db;

if (getApps().length === 0) {
  const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
  
  if (!projectId) {
    console.warn(
      '[FirebaseAdmin] Warning: GCLOUD_PROJECT or GOOGLE_CLOUD_PROJECT env var not set. Firebase Admin SDK may not initialize correctly.'
    );
  }

  try {
    adminApp = initializeApp({
      projectId,
      credential: applicationDefault(),
    });
    db = getFirestore(adminApp);
    console.log(`[FirebaseAdmin] Initialized successfully for project: ${projectId}`);
  } catch (error) {
    console.error('[FirebaseAdmin] Initialization failed:', error);
    // Fallback initialization without explicit project ID if the first attempt fails
    if (!getApps().length) {
        try {
            adminApp = initializeApp();
            db = getFirestore(adminApp);
            console.log('[FirebaseAdmin] Initialized with fallback.');
        } catch (fallbackError) {
            console.error('[FirebaseAdmin] Fallback initialization also failed:', fallbackError);
            // Ensure db is not undefined to prevent crashes on import
            db = {} as any; 
        }
    } else {
        adminApp = getApp();
        db = getFirestore(adminApp);
    }
  }
} else {
  adminApp = getApp();
  db = getFirestore(adminApp);
}

export { adminApp as app, db };
