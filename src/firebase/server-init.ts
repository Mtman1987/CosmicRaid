import { applicationDefault, getApp, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { firebaseConfig } from './config';
import path from 'path';
import fs from 'fs';
import { execFileSync } from 'child_process';

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
  [key: string]: any;
};

function parseServiceAccount(json: string | undefined | null): ServiceAccount | null {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch (error) {
    console.warn('[FirebaseAdmin] Failed to parse inline service account:', error);
    return null;
  }
}

function decodeBase64(json: string | undefined | null): ServiceAccount | null {
  if (!json) return null;
  try {
    const decoded = Buffer.from(json, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('[FirebaseAdmin] Failed to decode base64 service account:', error);
    return null;
  }
}

function readServiceAccountFromFile(filePath: string | undefined | null): ServiceAccount | null {
  if (!filePath) return null;
  try {
    const fullPath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.warn('[FirebaseAdmin] Failed to read service account file:', error);
    return null;
  }
}

function fetchServiceAccountFromFirestore(): ServiceAccount | null {
  const docPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_DOC_PATH ||
    'infrastructure/credentials/adminServiceAccount';
  const field =
    process.env.FIREBASE_SERVICE_ACCOUNT_DOC_FIELD || 'serviceAccountBase64';
  const apiKey =
    process.env.FIREBASE_WEB_API_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ||
    process.env.FIREBASE_API_KEY;
  const project =
    process.env.FIREBASE_SERVICE_ACCOUNT_DOC_PROJECT ||
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    firebaseConfig.projectId;

  if (!apiKey || !project || !docPath) {
    return null;
  }

  try {
    const encodedPath = docPath
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${encodedPath}?key=${apiKey}`;

    const script = `
const https=require('https');
const url=${JSON.stringify(url)};
https.get(url,(res)=>{let data='';
if(res.statusCode<200||res.statusCode>=300){
  console.error('status',res.statusCode);
  res.resume();
  process.exit(2);
}
res.on('data',(chunk)=>data+=chunk);
res.on('end',()=>{process.stdout.write(data);});
}).on('error',(err)=>{console.error(err);process.exit(1);});
`;
    const output = execFileSync(process.execPath, ['-e', script], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (!output) {
      return null;
    }
    const data = JSON.parse(output);
    const fields = data.fields || {};
    const rawValue: string | undefined = fields[field]?.stringValue;

    if (!rawValue) {
      console.warn('[FirebaseAdmin] Firestore credential doc missing expected field');
      return null;
    }

    const trimmed = rawValue.trim();
    if (trimmed.startsWith('{')) {
      return parseServiceAccount(trimmed);
    }
    return decodeBase64(trimmed);
  } catch (error) {
    console.warn('[FirebaseAdmin] Firestore credential fetch error:', error);
    return null;
  }
}

function resolveServiceAccount(): ServiceAccount | null {
  return (
    parseServiceAccount(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) ||
    decodeBase64(process.env.FIREBASE_SERVICE_ACCOUNT_B64) ||
    readServiceAccountFromFile(process.env.GOOGLE_APPLICATION_CREDENTIALS) ||
    fetchServiceAccountFromFirestore()
  );
}

let adminApp;

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? firebaseConfig.projectId;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  try {
    const serviceAccount = resolveServiceAccount();
    if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId,
        storageBucket,
      });
    } else {
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId,
        storageBucket,
      });
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    adminApp = initializeApp({
      projectId,
      storageBucket,
    });
  }
} else {
  adminApp = getApp();
}

const db = getFirestore(adminApp);

export { adminApp as app, db };
