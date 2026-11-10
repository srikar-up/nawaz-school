import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_KEY_FILE = path.resolve(__dirname, '../serviceAccountKey.json');

/**
 * Firebase Admin bootstrap.
 *
 * The Admin SDK bypasses Firestore security rules, which is the whole point of
 * this architecture: only this server can read or write the database, and the
 * browser talks to the Express API instead. Firestore rules therefore stay
 * "deny everything" for clients.
 *
 * Credentials are resolved in this order:
 *   1. FIREBASE_SERVICE_ACCOUNT_JSON  - the whole service-account JSON as one line
 *   2. GOOGLE_APPLICATION_CREDENTIALS - path to the JSON key file
 *   3. server/serviceAccountKey.json  - default local location (git-ignored)
 *   4. Application Default Credentials
 */
function resolveCredential() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return cert(JSON.parse(inline));
    } catch (error) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON: ${error.message}`);
    }
  }

  const configured = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const file = configured || (fs.existsSync(DEFAULT_KEY_FILE) ? DEFAULT_KEY_FILE : null);

  if (file) {
    if (!fs.existsSync(file)) {
      throw new Error(`Service account file not found: ${file}`);
    }
    try {
      return cert(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (error) {
      throw new Error(`Could not read service account file ${file}: ${error.message}`);
    }
  }

  return applicationDefault();
}

let app = null;
let db = null;

export function getFirebaseApp() {
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp({ credential: resolveCredential() });
  }
  return app;
}

export function adminDb() {
  if (!db) {
    getFirebaseApp();
    db = getFirestore();
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

/** True when the server has credentials it can actually use. */
export function hasAdminCredentials() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return true;
  const file = process.env.GOOGLE_APPLICATION_CREDENTIALS || DEFAULT_KEY_FILE;
  return fs.existsSync(file);
}
