'use server';

import { applicationDefault, getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';
import fs from 'fs';
import path from 'path';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

function resolveServiceAccount(): ServiceAccount | null {
  // 1. Prioritize JSON from environment variable (App Hosting secret)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    try {
      return JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    } catch (e) {
      console.warn('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON', e);
    }
  }

  // 2. Fallback to file path (local development)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    
    if (fs.existsSync(resolvedPath)) {
      try {
        const fileContent = fs.readFileSync(resolvedPath, 'utf8');
        return JSON.parse(fileContent);
      } catch (e) {
        console.warn(`Failed to read or parse service account file at ${resolvedPath}`, e);
      }
    }
  }

  // 3. If neither are present, return null and let applicationDefault handle it.
  return null;
}


let adminApp;

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? firebaseConfig.projectId;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const serviceAccount = resolveServiceAccount();
  
  const appOptions = {
    projectId,
    storageBucket,
    credential: serviceAccount ? cert(serviceAccount) : applicationDefault(),
  };

  try {
    adminApp = initializeApp(appOptions);
    console.log('[FirebaseAdmin] Initialized successfully.');
  } catch (error) {
    console.error('[FirebaseAdmin] Initialization failed:', error);
    // Fallback for environments where default creds are already set up
    // but the options object causes issues.
    adminApp = initializeApp();
  }
} else {
  adminApp = getApp();
}

const db = getFirestore(adminApp);

export { adminApp as app, db };
