import { FirebaseOptions } from 'firebase/app';

function readEnv(primary: string, fallback?: string) {
  return process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
}

const fallbackConfig: FirebaseOptions = {
  apiKey: 'AIzaSyA3gXBNiLdpJdTpOuTJt6UJs-yyHJqorgA',
  authDomain: 'studio-9468926194-e03ac.firebaseapp.com',
  projectId: 'studio-9468926194-e03ac',
  storageBucket: 'studio-9468926194-e03ac.firebasestorage.app',
  messagingSenderId: '3344718739',
  appId: '1:3344718739:web:a893f438d641753df1e666',
};

export const firebaseConfig: FirebaseOptions = {
  apiKey: readEnv('NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_API_KEY') ?? fallbackConfig.apiKey,
  authDomain: readEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_AUTH_DOMAIN') ?? fallbackConfig.authDomain,
  projectId: readEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID', 'NEXT_PUBLIC_PROJECT_ID') ?? fallbackConfig.projectId,
  storageBucket:
    readEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET', 'NEXT_PUBLIC_STORAGE_BUCKET') ?? fallbackConfig.storageBucket,
  messagingSenderId:
    readEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID', 'NEXT_PUBLIC_MESSAGING_SENDER_ID') ??
    fallbackConfig.messagingSenderId,
  appId: readEnv('NEXT_PUBLIC_FIREBASE_APP_ID', 'NEXT_PUBLIC_APP_ID') ?? fallbackConfig.appId,
};
