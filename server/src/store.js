import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed, SCHEMA_VERSION } from './seed.js';
import { buildCurriculaFromSubjects } from './curriculum.js';
import { isoDaysAgo, pruneAttendanceRecords } from './maintenance.js';
import {
  COLLECTION_KEYS,
  FIRESTORE_ROOT,
  LAYOUT_VERSION,
  RECORD_COLLECTIONS,
  clearFirestore,
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

/** How many recent mutation events are kept for `/api/changes`. */
const JOURNAL_LIMIT = Math.max(Number(process.env.CHANGE_JOURNAL_LIMIT) || 300, 20);
/** A whole collection larger than this is not pushed over SSE; clients refetch. */
const EVENT_RECORD_LIMIT = 250;
const EVENT_BYTES_LIMIT = 96 * 1024;

export const storeEvents = new EventEmitter();
storeEvents.setMaxListeners(50);

let db = null;
let lastSynced = null;
let syncQueue = Promise.resolve();
let lastSyncAt = null;
let lastSyncError = null;
let lastSyncResult = null;
let retryChanges = null;
let journal = [];
let changeSequence = 0;

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
 * One-time migration for databases created before curricula existed.
 * Derives one shared syllabus per grade + subject from the class offerings and
 * records a flag so a deliberately emptied curriculum list stays empty.
 */
function ensureCurricula(database) {
  if (database.meta?.curriculaSeeded) return false;
  if (!Array.isArray(database.curricula) || !database.curricula.length) {
    database.curricula = buildCurriculaFromSubjects(database.subjects || []);
  }
  database.meta = { ...(database.meta || {}), curriculaSeeded: true };
  return true;
}

/** Optional boot-time retention; disabled unless ATTENDANCE_RETENTION_DAYS > 0. */
function applyAttendanceRetention(database) {
  const days = Number(process.env.ATTENDANCE_RETENTION_DAYS || 0);
  if (!Number.isFinite(days) || days <= 0) return [];
  return pruneAttendanceRecords(database, isoDaysAgo(days));
}

/* ------------------------------------------------------------------ */
/* Mutation tracking                                                   */
/* ------------------------------------------------------------------ */

function emptyChanges() {
  return { full: false, collections: new Set(), records: new Map() };
}

let pendingChanges = null;

function currentTracking() {
  if (!pendingChanges) pendingChanges = emptyChanges();
  return pendingChanges;
}

/**
 * Marks one record as changed. Endpoints call this inside `mutate` so a
 * single attendance register or mark writes one Firestore document, not the
 * whole collection.
 */
export function trackRecord(collection, id, kind = 'set') {
  if (!id || !COLLECTION_KEYS.includes(collection)) return;
  const changes = currentTracking();
  if (changes.collections.has(collection)) return;
  let ids = changes.records.get(collection);
  if (!ids) {
    ids = new Map();
    changes.records.set(collection, ids);
  }
  ids.set(String(id), kind === 'delete' ? 'delete' : 'set');
}

/** Marks a whole collection as changed. Used by imports and bulk operations. */
export function trackCollection(collection) {
  if (!COLLECTION_KEYS.includes(collection)) return;
  currentTracking().collections.add(collection);
}

function mergeChanges(target, source) {
  if (!target) return source;
  if (!source) return target;
  target.full = target.full || source.full;
  source.collections.forEach((key) => target.collections.add(key));
  source.records.forEach((ids, key) => {
    let existing = target.records.get(key);
    if (!existing) {
      existing = new Map();
      target.records.set(key, existing);
    }
    ids.forEach((kind, id) => {
      existing.set(id, kind);
      // A record that is part of a full collection does not need a specific
      // entry; the full diff will handle it.
    });
  });
  return target;
}

function summarizeChanges(changes) {
  const records = [...changes.records.values()].reduce((sum, ids) => sum + ids.size, 0);
  return {
    full: Boolean(changes.full),
    collections: [...changes.collections],
    records,
  };
}

/**
 * Builds the patch sent over SSE and served by `/api/changes`.
 *
 * Small changes travel as records (`upserts`/`deletes`). A large change - an
 * import, a reset, or a bulk roster operation - is marked `full` so clients
 * refetch once instead of receiving a multi-megabyte event.
 */
function buildChangeEvent(database, changes) {
  const event = {
    revision: database.meta.revision,
    updatedAt: database.meta.updatedAt,
    full: Boolean(changes.full),
  };
  let recordCount = 0;

  if (changes.collections.has('meta') || event.full) {
    event.meta = { ...database.meta };
  }

  for (const key of changes.collections) {
    if (key === 'meta') continue;
    // The audit log is capped and paginated by the dashboard. Sending all 150
    // rows with every mutation would dwarf the actual change; screens reload
    // it when they open or on focus.
    if (key === 'activities') continue;
    const items = database[key] || [];
    const isLargeRecordSet = RECORD_COLLECTIONS.includes(key) && items.length > 60;
    if (isLargeRecordSet || items.length > EVENT_RECORD_LIMIT) {
      event.full = true;
      continue;
    }
    event.collections = event.collections || {};
    event.collections[key] = items;
    recordCount += items.length;
  }

  if (!event.full) {
    // Small config collections travel whole so their order stays exact and a
    // new row (announcement, ticket) lands where the server put it.
    for (const key of changes.records.keys()) {
      if (
        changes.collections.has(key) ||
        RECORD_COLLECTIONS.includes(key) ||
        key === 'activities'
      ) {
        continue;
      }
      const items = database[key] || [];
      if (items.length > EVENT_RECORD_LIMIT) {
        event.full = true;
        break;
      }
      event.collections = event.collections || {};
      event.collections[key] = items;
      recordCount += items.length;
    }
  }

  if (!event.full) {
    for (const [key, ids] of changes.records) {
      if (changes.collections.has(key)) continue;
      if (!RECORD_COLLECTIONS.includes(key)) continue;
      const byId = new Map((database[key] || []).map((record) => [record.id, record]));
      const upserts = [];
      const deletes = [];
      for (const [id, kind] of ids) {
        const record = byId.get(id);
        if (kind === 'delete' || !record) deletes.push(id);
        else upserts.push(record);
      }
      if (upserts.length) {
        event.upserts = event.upserts || {};
        event.upserts[key] = upserts;
      }
      if (deletes.length) {
        event.deletes = event.deletes || {};
        event.deletes[key] = deletes;
      }
      recordCount += upserts.length + deletes.length;
    }
  }

  if (!event.full && recordCount > EVENT_RECORD_LIMIT) event.full = true;
  if (!event.full) {
    const bytes = JSON.stringify(event).length;
    if (bytes > EVENT_BYTES_LIMIT) event.full = true;
  }
  if (event.full) {
    delete event.collections;
    delete event.upserts;
    delete event.deletes;
  }
  return event;
}

function rememberEvent(event) {
  journal.push(event);
  if (journal.length > JOURNAL_LIMIT) journal = journal.slice(-JOURNAL_LIMIT);
}

/** Recent mutations for `/api/changes`; null when the gap is too old. */
export function getChangesSince(sinceRevision) {
  const currentRevision = getRevision();
  const since = Number(sinceRevision);
  if (!Number.isFinite(since) || since < 0) return { full: true, revision: currentRevision };
  if (since >= currentRevision) return { revision: currentRevision, unchanged: true };
  if (!journal.length) return { full: true, revision: currentRevision };

  const first = journal[0]?.revision;
  if (since < first - 1) return { full: true, revision: currentRevision };

  const merged = { revision: currentRevision, meta: null, collections: {}, upserts: {}, deletes: {} };
  let found = false;

  for (const event of journal) {
    if (event.revision <= since) continue;
    found = true;
    if (event.full) return { full: true, revision: currentRevision, updatedAt: event.updatedAt };
    if (event.meta) merged.meta = event.meta;
    if (event.collections) {
      Object.entries(event.collections).forEach(([key, items]) => {
        merged.collections[key] = items;
        delete merged.upserts[key];
        delete merged.deletes[key];
      });
    }
    if (event.upserts) {
      Object.entries(event.upserts).forEach(([key, rows]) => {
        if (merged.collections[key]) return;
        const map = new Map((merged.upserts[key] || []).map((row) => [row.id, row]));
        rows.forEach((row) => map.set(row.id, row));
        merged.upserts[key] = [...map.values()];
        if (merged.deletes[key]) {
          merged.deletes[key] = merged.deletes[key].filter((id) => !map.has(id));
        }
      });
    }
    if (event.deletes) {
      Object.entries(event.deletes).forEach(([key, ids]) => {
        if (merged.collections[key]) return;
        const set = new Set(merged.deletes[key] || []);
        ids.forEach((id) => set.add(id));
        if (merged.upserts[key]) {
          merged.upserts[key] = merged.upserts[key].filter((row) => !set.has(row.id));
        }
        merged.deletes[key] = [...set];
      });
    }
  }

  if (!found) return { revision: currentRevision, unchanged: true };
  merged.updatedAt = getDb().meta.updatedAt;
  return merged;
}

export function getJournalBounds() {
  return {
    size: journal.length,
    limit: JOURNAL_LIMIT,
    oldestRevision: journal[0]?.revision ?? null,
    newestRevision: journal[journal.length - 1]?.revision ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

/**
 * Mirrors the in-memory database into Firestore.
 * Serialized through a promise chain so writes never overlap or arrive out of
 * order. Returns the queued promise so callers can await durability.
 */
function queueFirestoreSync(changes = null) {
  if (!isFirestoreEnabled()) return Promise.resolve();

  const snapshot = db;
  const queued = mergeChanges(
    retryChanges || (changes ? emptyChanges() : null),
    changes
  );
  retryChanges = null;
  changeSequence += 1;
  const sequence = changeSequence;

  syncQueue = syncQueue
    .then(async () => {
      const result = await saveDbToFirestore(snapshot, lastSynced, queued);
      lastSynced = structuredClone(snapshot);
      lastSyncAt = new Date().toISOString();
      lastSyncError = null;
      lastSyncResult = result;
      if (result.writes || result.deletes) {
        console.log(
          `[firestore] saved ${result.writes} document(s)${
            result.deletes ? `, deleted ${result.deletes}` : ''
          }${result.migrated ? ' (layout v2 migration)' : ''}`
        );
      }
    })
    .catch((error) => {
      lastSyncError = error.message;
      // Keep the tracked changes so the next mutation retries them. The
      // in-memory state is still the source of truth for this isolate.
      retryChanges = mergeChanges(retryChanges || emptyChanges(), queued);
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
  } else if (ensureCurricula(db)) {
    persist();
    console.log(`[data] Added ${db.curricula.length} grade curricula.`);
  }
  const pruned = applyAttendanceRetention(db);
  if (pruned.length) {
    db.meta.revision += 1;
    db.meta.updatedAt = new Date().toISOString();
    persist();
    console.log(`[data] Retention removed ${pruned.length} old attendance register(s).`);
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
      const curriculaChanged = ensureCurricula(db);
      const needsLayoutMigration = Number(db.meta?.layoutVersion || 1) < LAYOUT_VERSION;

      if (needsLayoutMigration) {
        db.meta = { ...db.meta, layoutVersion: LAYOUT_VERSION };
        console.log(
          `[data] Migrating Firestore to per-record layout v${LAYOUT_VERSION}...`
        );
        await saveDbToFirestore(db, null);
        lastSynced = structuredClone(db);
        lastSyncAt = new Date().toISOString();
        lastSyncResult = { migrated: true };
      } else if (curriculaChanged) {
        const changes = emptyChanges();
        changes.collections.add('curricula');
        changes.collections.add('meta');
        await queueFirestoreSync(changes);
      }

      const pruned = applyAttendanceRetention(db);
      if (pruned.length) {
        db.meta.revision += 1;
        db.meta.updatedAt = new Date().toISOString();
        const changes = emptyChanges();
        changes.collections.add('meta');
        const deleted = new Map();
        pruned.forEach((session) => deleted.set(session.id, 'delete'));
        changes.records.set('attendanceSessions', deleted);
        await saveDbToFirestore(db, lastSynced, changes);
        lastSynced = structuredClone(db);
        lastSyncAt = new Date().toISOString();
        console.log(
          `[data] Retention removed ${pruned.length} old attendance register(s).`
        );
      }

      console.log(
        `[data] Loaded from Firestore - revision ${db.meta.revision}, ${db.students.length} students.`
      );
      return db;
    }

    db = buildSeed();
    db.meta.layoutVersion = LAYOUT_VERSION;
    persist();
    console.log(
      `[data] Seeded Firestore - ${db.students.length} students, ${db.staff.length} staff.`
    );
    await saveDbToFirestore(db, null);
    lastSynced = structuredClone(db);
    lastSyncAt = new Date().toISOString();
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

export function mutate(mutator, { full = false } = {}) {
  const current = getDb();
  const before = new Map(
    COLLECTION_KEYS.map((key) => [
      key,
      { ref: current[key], length: Array.isArray(current[key]) ? current[key].length : 0 },
    ])
  );

  pendingChanges = emptyChanges();
  try {
    mutator(current);
  } catch (error) {
    pendingChanges = null;
    throw error;
  }

  current.meta.revision += 1;
  current.meta.updatedAt = new Date().toISOString();
  current.meta.layoutVersion = LAYOUT_VERSION;

  // Safety net: an endpoint that added/removed records but forgot to call
  // trackRecord would otherwise silently stay in memory. Detect array changes
  // and fall back to a full collection diff, with a warning so the gap can be
  // fixed. Config collections are small, so this is cheap for them.
  COLLECTION_KEYS.forEach((key) => {
    if (key === 'meta') return;
    const previous = before.get(key);
    if (!previous) return;
    const next = current[key];
    const changedRef = next !== previous.ref;
    const changedLength = Array.isArray(next) && next.length !== previous.length;
    if (!changedRef && !changedLength) return;
    if (pendingChanges.collections.has(key) || pendingChanges.records.has(key)) return;
    pendingChanges.collections.add(key);
    console.warn(
      `[store] ${key} changed without record tracking; writing a full collection diff.`
    );
  });

  pendingChanges.collections.add('meta');
  const changes = pendingChanges;
  changes.full = changes.full || full;
  pendingChanges = null;

  const event = buildChangeEvent(current, changes);
  rememberEvent(event);
  persist();
  queueFirestoreSync(changes);
  storeEvents.emit('change', event);
  return current;
}

export function resetStore() {
  db = buildSeed();
  db.meta.revision += 1;
  db.meta.updatedAt = new Date().toISOString();
  db.meta.layoutVersion = LAYOUT_VERSION;
  persist();
  lastSynced = null;

  const event = {
    revision: db.meta.revision,
    updatedAt: db.meta.updatedAt,
    full: true,
    reset: true,
  };
  rememberEvent(event);

  if (isFirestoreEnabled()) {
    syncQueue = syncQueue
      .then(async () => {
        await clearFirestore();
        const result = await saveDbToFirestore(db, null);
        lastSynced = structuredClone(db);
        lastSyncAt = new Date().toISOString();
        lastSyncError = null;
        lastSyncResult = result;
      })
      .catch((error) => {
        lastSyncError = error.message;
        retryChanges = emptyChanges();
        retryChanges.full = true;
        console.error('[firestore] reset failed:', error.message);
      });
  }

  storeEvents.emit('change', event);
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

export function getSyncStatus() {
  return {
    backend: getBackendName(),
    lastSyncAt,
    lastSyncError,
    lastSync: lastSyncResult,
    journal: getJournalBounds(),
    retrying: retryChanges ? summarizeChanges(retryChanges) : null,
    layoutVersion: LAYOUT_VERSION,
  };
}
