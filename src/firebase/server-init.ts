import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: admin.app.App;

if (!admin.apps.length) {
  // Explicitly initialize with the project ID from the App Hosting environment.
  // This helps the Admin SDK correctly locate its credentials and avoids
  // intermittent authentication errors.
  app = admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
  });
} else {
  app = admin.apps[0]!;
}

export const db = getFirestore(app);
export const auth = getAuth(app);
