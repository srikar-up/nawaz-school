import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed, SCHEMA_VERSION } from './seed.js';
import {
  FIRESTORE_ROOT,
  isFirestoreEnabled,
  loadDbFromFirestore,
  saveDbToFirestore,
} from './firestore-store.js';

// import.meta.url is undefined in the Workers bundle; the directory is only
// used by the Node server (JSON cache and static app paths).
const __dirname = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return '/';
  }
})();
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(__dirname, '../data');
const DATABASE_FILE = path.join(DATA_DIR, 'db.json');

export const storeEvents = new EventEmitter();
storeEvents.setMaxListeners(50);

let db = null;
let lastSynced = null;
let syncQueue = Promise.resolve();

/**
 * Local JSON mirror. Disabled on Workers (`DISABLE_FILE_CACHE=true`) where the
 * filesystem is read-only - the in-memory database is the working copy and
 * Firestore is the source of truth.
 */
const FILE_CACHE = String(process.env.DISABLE_FILE_CACHE || '').toLowerCase() !== 'true';

function persist() {
  if (!FILE_CACHE) return;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tempFile = `${DATABASE_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DATABASE_FILE);
  } catch (error) {
    console.warn('[data] could not write the local cache:', error.message);
  }
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATABASE_FILE)) return null;
    const raw = fs.readFileSync(DATABASE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.meta?.schemaVersion !== SCHEMA_VERSION) {
      console.log('[data] Schema changed - reseeding demo database.');
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('[data] Could not read db.json; reseeding.', error.message);
    return null;
  }
}

/**
 * Mirrors the in-memory database into Firestore.
 * Serialized through a promise chain so writes never overlap or arrive out of order.
 * Returns the queued promise so callers can await durability.
 */
function queueFirestoreSync() {
  if (!isFirestoreEnabled()) return Promise.resolve();

  const snapshot = db;
  const previous = lastSynced;

  syncQueue = syncQueue
    .then(async () => {
      const writes = await saveDbToFirestore(snapshot, previous);
      lastSynced = structuredClone(snapshot);
      if (writes > 0) console.log(`[firestore] synced ${writes} document(s)`);
    })
    .catch((error) => {
      console.error('[firestore] sync failed:', error.message);
    });

  return syncQueue;
}

/** Synchronous boot for the local JSON backend. */
export function initStore({ force = false } = {}) {
  if (force) db = null;
  else db = loadFromDisk();

  if (!db) {
    db = buildSeed();
    persist();
    console.log(`[data] Seeded ${db.students.length} students, ${db.staff.length} staff.`);
  }
  return db;
}

/**
 * Boot loader. Uses Firestore when DATA_BACKEND=firestore, otherwise the local
 * JSON file. Falls back to JSON if Firestore is unreachable so the API still starts.
 *
 * The initial seed upload is awaited: a process that exits right after seeding
 * must not lose the write.
 */
export async function initStoreAsync({ force = false } = {}) {
  if (!isFirestoreEnabled()) return initStore({ force });

  try {
    const remote = force ? null : await loadDbFromFirestore();

    if (remote && remote.meta?.schemaVersion === SCHEMA_VERSION) {
      db = remote;
      lastSynced = structuredClone(db);
      console.log(
        `[data] Loaded from Firestore - revision ${db.meta.revision}, ${db.students.length} students.`
      );
      return db;
    }

    db = buildSeed();
    persist();
    console.log(
      `[data] Seeded Firestore - ${db.students.length} students, ${db.staff.length} staff.`
    );
    await queueFirestoreSync();
    return db;
  } catch (error) {
    // Never serve seed data from a Worker: a mutation would then overwrite the
    // real Firestore database. Fail the request instead and let it retry.
    if (String(process.env.RUNTIME || '') === 'workers') {
      throw new Error(`Firestore is unavailable: ${error.message}`);
    }
    console.warn(`[firestore] boot failed (${error.message}); falling back to local JSON.`);
    return initStore({ force });
  }
}

export function getDb() {
  if (!db) initStore();
  return db;
}

export function getRevision() {
  return getDb().meta.revision;
}

export function mutate(mutator) {
  const current = getDb();
  mutator(current);
  current.meta.revision += 1;
  current.meta.updatedAt = new Date().toISOString();
  persist();
  queueFirestoreSync();
  storeEvents.emit('change', {
    revision: current.meta.revision,
    updatedAt: current.meta.updatedAt,
  });
  return current;
}

export function resetStore() {
  db = buildSeed();
  db.meta.revision += 1;
  persist();
  lastSynced = null;
  queueFirestoreSync();
  storeEvents.emit('change', {
    revision: db.meta.revision,
    updatedAt: db.meta.updatedAt,
    reset: true,
  });
  return db;
}

export function getDatabaseFile() {
  return isFirestoreEnabled() ? `firestore://${FIRESTORE_ROOT}` : DATABASE_FILE;
}

/** Name of the active persistence backend, for logs and /api/health. */
export function getBackendName() {
  return isFirestoreEnabled() ? 'firestore' : 'local-json';
}

/** Resolves once every queued Firestore write has settled. */
export function flushStore() {
  return syncQueue;
}
