import { applicationDefault, getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';

let adminApp;

if (getApps().length === 0) {
  try {
    // Try to use service account file if available
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccountPath) {
      const path = require('path');
      const fs = require('fs');
      const fullPath = path.resolve(process.cwd(), serviceAccountPath);
      const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? firebaseConfig.projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    } else {
      // Fallback to application default credentials
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? firebaseConfig.projectId,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      });
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    // Fallback initialization with minimal config
    adminApp = initializeApp({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID ?? firebaseConfig.projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    });
  }
} else {
  adminApp = getApp();
}

const db = getFirestore(adminApp);

export { adminApp as app, db };
