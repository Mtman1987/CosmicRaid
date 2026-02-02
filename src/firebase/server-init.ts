import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let app: admin.app.App;

if (!admin.apps.length) {
  // When running in a Google Cloud environment like App Hosting, we use
  // applicationDefault() which automatically finds the service account credentials.
  // Explicitly providing the projectId helps prevent the SDK from mistakenly
  // trying to use a local credential file if GOOGLE_APPLICATION_CREDENTIALS
  // is set in a local development environment.
  app = admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
  });
} else {
  app = admin.apps[0]!;
}

export const db = getFirestore(app);
export const auth = getAuth(app);
