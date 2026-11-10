import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

/**
 * Firebase client bootstrap for the teacher PWA.
 *
 * Config comes from VITE_FIREBASE_* in `.env.local` (see `.env.example`).
 * These values are public identifiers, not secrets - access control lives in
 * Firestore rules and Firebase Auth.
 *
 * Firestore is loaded on demand so the initial bundle stays small; call
 * `getDb()` from any module that needs it.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!isFirebaseConfigured) {
  console.warn(
    '[firebase] Missing VITE_FIREBASE_* variables. Copy .env.example to .env.local and fill it in.'
  );
}

export const firebaseApp = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

export const auth = firebaseApp ? getAuth(firebaseApp) : null;

let dbPromise = null;

/** Lazily resolves the Firestore instance, or null when Firebase is unconfigured. */
export function getDb() {
  if (!firebaseApp) return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = import('firebase/firestore').then(({ getFirestore }) => getFirestore(firebaseApp));
  }
  return dbPromise;
}

export default firebaseApp;
