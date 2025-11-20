import { applicationDefault, getApp, getApps, initializeApp, cert, type App } from 'firebase-admin/app';
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
  const apiKey = firebaseConfig.apiKey;
  const project = firebaseConfig.projectId;
  // Firebase Admin needs to initialize without server context
  // Server-specific secrets are loaded per-request via user-server mapping
  const serverId = 'global'; // Firebase Admin is global, secrets are per-server
  const docPath = `servers/${serverId}/config/secrets`;
  const field = 'GOOGLE_APPLICATION_CREDENTIALS';

  console.log('[FirebaseAdmin] Fetching credentials from server secrets:', { project, serverId, docPath, field });

  if (!apiKey || !project) {
    console.warn('[FirebaseAdmin] Missing API key or project ID for Firestore fetch');
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
      console.warn('[FirebaseAdmin] Server secrets doc missing GOOGLE_APPLICATION_CREDENTIALS field');
      return null;
    }

    console.log('[FirebaseAdmin] Found credential data in server secrets, parsing...');
    const trimmed = rawValue.trim();
    if (trimmed.startsWith('{')) {
      console.log('[FirebaseAdmin] Parsing credentials as JSON');
      return parseServiceAccount(trimmed);
    }
    console.log('[FirebaseAdmin] Decoding credentials as base64');
    return decodeBase64(trimmed);
  } catch (error) {
    console.error('[FirebaseAdmin] Firestore credential fetch error:', error);
    return null;
  }
}

function resolveServiceAccount(): ServiceAccount | null {
  console.log('[FirebaseAdmin] Attempting to resolve service account from database first');
  return (
    fetchServiceAccountFromFirestore() ||
    parseServiceAccount(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) ||
    decodeBase64(process.env.FIREBASE_SERVICE_ACCOUNT_B64) ||
    readServiceAccountFromFile(process.env.GOOGLE_APPLICATION_CREDENTIALS)
  );
}

let adminApp: App;

if (getApps().length === 0) {
  const projectId = firebaseConfig.projectId;
  const storageBucket = firebaseConfig.storageBucket;

  console.log('[FirebaseAdmin] Initializing with projectId:', projectId);

  try {
    const serviceAccount = resolveServiceAccount();
    if (serviceAccount) {
      console.log('[FirebaseAdmin] Using service account credentials');
      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId,
        storageBucket,
      });
    } else {
      console.log('[FirebaseAdmin] Using application default credentials');
      adminApp = initializeApp({
        credential: applicationDefault(),
        projectId,
        storageBucket,
      });
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    console.log('[FirebaseAdmin] Falling back to minimal config');
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
