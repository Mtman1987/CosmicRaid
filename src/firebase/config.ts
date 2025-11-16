import { FirebaseOptions } from 'firebase/app';

function readEnv(primary: string, fallback?: string) {
  return process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
}

const fallbackConfig: FirebaseOptions = {
  apiKey: 'AIzaSyD2W8vjLKUC7HqctFFIc6d164QG8w_IYKo',
  authDomain: 'studio-5587063777-d2e6c.firebaseapp.com',
  projectId: 'studio-5587063777-d2e6c',
  storageBucket: 'studio-5587063777-d2e6c.appspot.com',
  messagingSenderId: '2349523999',
  appId: '1:2349523999:web:d1275bdff4c564e7bda12a',
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
