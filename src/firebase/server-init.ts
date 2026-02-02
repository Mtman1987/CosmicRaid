
import admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

// The correct Project ID for the Firestore database.
const DATABASE_PROJECT_ID = "studio-9468926194-e03ac";

let db: Firestore;
let auth: Auth;

try {
  if (!admin.apps.length) {
    console.log('[Firebase Admin] Initializing SDK...');
    
    // Explicitly initialize with the correct database project ID.
    // This resolves authentication issues in a split-project (hosting vs. database) setup.
    admin.initializeApp({
      projectId: DATABASE_PROJECT_ID,
    });
    
    console.log(`[Firebase Admin] SDK initialized successfully for project: ${DATABASE_PROJECT_ID}`);
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
