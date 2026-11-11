import { adminDb } from './firebase.js';

/**
 * Firestore persistence for the Express API.
 *
 * The browser never touches Firestore - this module is the only writer, and it
 * runs on the server through the Firebase Admin SDK (which bypasses rules).
 *
 * Layout v2 (`meta.layoutVersion === 2`)
 * --------------------------------------
 * Small, rarely changing collections stay in one document each:
 *
 *   school/meta                 <- profile, revision, layoutVersion, ...
 *   school/staff                <- { items: [...] }
 *   school/classes              <- { items: [...] }
 *   ...
 *
 * High-growth collections use one document per record instead, so a single
 * attendance register or mark never competes for the 1 MiB document limit:
 *
 *   school/records/students/<studentId>
 *   school/records/attendanceSessions/<sessionId>
 *   school/records/testRecords/<recordId>
 *   school/records/staffAttendance/<recordId>
 *
 * Layout v1 (the original one-document-per-collection design) is read once and
 * migrated on the next boot. The legacy documents are deleted after a
 * successful migration.
 *
 * Writes are diffed and batched. A mutation that changes one register writes
 * one register document, not the whole collection - which is also what keeps
 * two Worker isolates from overwriting each other's unrelated records.
 */
export const FIRESTORE_ROOT = process.env.FIRESTORE_ROOT || 'school';

export const COLLECTION_KEYS = [
  'staff',
  'classes',
  'students',
  'subjects',
  'curricula',
  'timetable',
  'exams',
  'testRecords',
  'assignments',
  'attendanceSessions',
  'staffAttendance',
  'classIncharges',
  'announcements',
  'rmsTickets',
  'activities',
];

/**
 * Collections that grow with every school day or exam. These are stored as one
 * Firestore document per record.
 */
export const RECORD_COLLECTIONS = [
  'students',
  'testRecords',
  'attendanceSessions',
  'staffAttendance',
];

export const CONFIG_COLLECTIONS = COLLECTION_KEYS.filter(
  (key) => !RECORD_COLLECTIONS.includes(key)
);

export const LAYOUT_VERSION = 2;

/** Firestore rejects documents over 1 MiB; stop well before that. */
export const MAX_DOCUMENT_BYTES = 900 * 1024;

/** Firestore allows 500 writes per batch; leave room for deletes and meta. */
const MAX_BATCH_WRITES = 400;

export function isFirestoreEnabled() {
  return String(process.env.DATA_BACKEND || '').toLowerCase() === 'firestore';
}

function documentBytes(value) {
  const text = JSON.stringify(value);
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(text, 'utf8');
  return new TextEncoder().encode(text).length;
}

export function assertDocumentSize(label, value) {
  const bytes = documentBytes(value);
  if (bytes > MAX_DOCUMENT_BYTES) {
    const mib = (bytes / (1024 * 1024)).toFixed(2);
    throw new Error(
      `${label} is ${mib} MiB, over the ${(MAX_DOCUMENT_BYTES / (1024 * 1024)).toFixed(
        2
      )} MiB safety limit. Split this collection into per-record documents.`
    );
  }
  return bytes;
}

async function readCollection(collectionRef) {
  const snapshot = await collectionRef.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

/**
 * Record documents live under `school/records/<collection>/<id>`.
 * `school/records` is a document, and each collection is a subcollection of
 * it, which is valid Firestore and keeps record writes out of the config
 * documents entirely.
 */
function recordCollection(root, key) {
  return root.doc('records').collection(key);
}

/** Returns the stored database, or null when Firestore has never been seeded. */
export async function loadDbFromFirestore() {
  const root = adminDb().collection(FIRESTORE_ROOT);
  const metaSnap = await root.doc('meta').get();
  if (!metaSnap.exists) return null;

  const meta = metaSnap.data() || {};
  const layoutVersion = Number(meta.layoutVersion || 1);

  if (layoutVersion < LAYOUT_VERSION) {
    // Legacy layout: one document per collection, each shaped { items: [...] }.
    const [configSnaps, recordSnaps] = await Promise.all([
      Promise.all(CONFIG_COLLECTIONS.map((key) => root.doc(key).get())),
      Promise.all(RECORD_COLLECTIONS.map((key) => root.doc(key).get())),
    ]);
    const result = { meta: { ...meta, layoutVersion } };
    CONFIG_COLLECTIONS.forEach((key, index) => {
      result[key] = configSnaps[index].exists ? configSnaps[index].data().items ?? [] : [];
    });
    RECORD_COLLECTIONS.forEach((key, index) => {
      result[key] = recordSnaps[index].exists ? recordSnaps[index].data().items ?? [] : [];
    });
    return result;
  }

  // Layout v2: small collections as documents, high-growth collections listed
  // from their subcollections. The reads run in parallel; a cold start pays
  // for them once and keeps the working copy in memory.
  const [configSnaps, recordDocs] = await Promise.all([
    Promise.all(CONFIG_COLLECTIONS.map((key) => root.doc(key).get())),
    Promise.all(RECORD_COLLECTIONS.map((key) => readCollection(recordCollection(root, key)))),
  ]);

  const result = { meta };
  CONFIG_COLLECTIONS.forEach((key, index) => {
    result[key] = configSnaps[index].exists ? configSnaps[index].data().items ?? [] : [];
  });
  RECORD_COLLECTIONS.forEach((key, index) => {
    result[key] = recordDocs[index].map((entry) => ({ ...entry.data, id: entry.data.id || entry.id }));
  });
  return result;
}

function diffCollection(next, previous) {
  const upserts = [];
  const deletes = [];
  const previousById = new Map((previous || []).map((record) => [record.id, record]));
  const nextIds = new Set();

  for (const record of next || []) {
    nextIds.add(record.id);
    const before = previousById.get(record.id);
    if (!before || JSON.stringify(before) !== JSON.stringify(record)) upserts.push(record);
  }
  for (const record of previous || []) {
    if (!nextIds.has(record.id)) deletes.push(record.id);
  }
  return { upserts, deletes };
}

function mergeChangeSets(...sets) {
  const merged = { collections: new Set(), records: new Map(), full: false };
  for (const set of sets) {
    if (!set) continue;
    if (set.full) merged.full = true;
    (set.collections || []).forEach((key) => merged.collections.add(key));
    (set.records || new Map()).forEach((ids, key) => {
      let target = merged.records.get(key);
      if (!target) {
        target = new Map();
        merged.records.set(key, target);
      }
      ids.forEach((kind, id) => target.set(id, kind));
    });
  }
  return merged;
}

async function commitWrites(store, root, writes) {
  let written = 0;
  for (let offset = 0; offset < writes.length; offset += MAX_BATCH_WRITES) {
    const chunk = writes.slice(offset, offset + MAX_BATCH_WRITES);
    if (!chunk.length) continue;
    const batch = store.batch();
    for (const entry of chunk) {
      if (entry.kind === 'delete') batch.delete(entry.ref);
      else batch.set(entry.ref, entry.data);
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

/**
 * Writes only what changed.
 *
 * @param {object} db current in-memory database
 * @param {object|null} previous snapshot taken after the last successful sync
 * @param {object|null} changes tracked mutations:
 *   { full, collections: Set<string>, records: Map<string, Map<string,'set'|'delete'>> }
 *   When omitted, every collection is diffed against `previous`.
 * @returns {{writes:number, deletes:number, collections:string[]}}
 */
export async function saveDbToFirestore(db, previous, changes = null) {
  const store = adminDb();
  const root = store.collection(FIRESTORE_ROOT);

  const previousLayout = Number(previous?.meta?.layoutVersion || 1);
  const migrating = previousLayout < LAYOUT_VERSION;
  const rev = Number(db.meta?.revision || Date.now());
  const writeEverything = !previous || migrating;
  const changeSet = mergeChangeSets(
    changes,
    writeEverything ? { full: true, collections: COLLECTION_KEYS, records: new Map() } : null
  );

  const writes = [];
  const touched = new Set();
  let deleteCount = 0;

  // Small collections: one document each.
  for (const key of CONFIG_COLLECTIONS) {
    const next = db[key] || [];
    const prev = migrating ? undefined : previous?.[key];
    const hinted =
      changeSet.full || changeSet.collections.has(key) || changeSet.records.has(key);
    const changed =
      writeEverything ||
      hinted ||
      (previous ? JSON.stringify(next) !== JSON.stringify(prev) : true);
    if (!changed) continue;

    const payload = { items: next };
    assertDocumentSize(`school/${key}`, payload);
    writes.push({ kind: 'set', ref: root.doc(key), data: payload });
    touched.add(key);
  }

  // High-growth collections: one document per record.
  for (const key of RECORD_COLLECTIONS) {
    const next = db[key] || [];
    const prev = migrating ? undefined : previous?.[key];
    const hinted = changeSet.full || changeSet.collections.has(key);
    const specific = changeSet.records.get(key);

    let upserts = [];
    let deletes = [];
    if (writeEverything || hinted) {
      const diff = diffCollection(next, prev);
      upserts = diff.upserts;
      deletes = diff.deletes;
    } else if (specific) {
      const nextById = new Map(next.map((record) => [record.id, record]));
      for (const [id, kind] of specific) {
        if (kind === 'delete' || !nextById.has(id)) deletes.push(id);
        else upserts.push(nextById.get(id));
      }
    } else {
      continue;
    }

    if (!upserts.length && !deletes.length) continue;
    touched.add(key);
    for (const record of upserts) {
      if (!record?.id) {
        console.warn(`[firestore] skipping a ${key} record without an id`);
        continue;
      }
      assertDocumentSize(`${FIRESTORE_ROOT}/${key}/${record.id}`, record);
      writes.push({ kind: 'set', ref: recordCollection(root, key).doc(record.id), data: record });
    }
    for (const id of deletes) {
      if (!id) continue;
      writes.push({ kind: 'delete', ref: recordCollection(root, key).doc(id) });
      deleteCount += 1;
    }
  }

  // Meta always moves with a mutation: revision and timestamps are used by the
  // clients and by the delta-sync journal. A no-op save writes nothing.
  const metaChanged =
    writeEverything ||
    !previous ||
    Number(db.meta?.layoutVersion || 1) < LAYOUT_VERSION ||
    JSON.stringify(db.meta) !== JSON.stringify(previous.meta);
  if (metaChanged) {
    assertDocumentSize(`${FIRESTORE_ROOT}/meta`, db.meta || {});
    writes.push({
      kind: 'set',
      ref: root.doc('meta'),
      data: {
        ...(db.meta || {}),
        revision: rev,
        layoutVersion: LAYOUT_VERSION,
      },
    });
    touched.add('meta');
  }

  if (migrating) {
    // The old collection documents are now stale duplicates. Removing them
    // keeps a future load (and the console) clean.
    for (const key of RECORD_COLLECTIONS) {
      writes.push({ kind: 'delete', ref: root.doc(key) });
      deleteCount += 1;
    }
  }

  if (writes.length) {
    await commitWrites(store, root, writes);
  }

  return {
    writes: writes.length - deleteCount,
    deletes: deleteCount,
    collections: [...touched],
    migrated: migrating,
  };
}

/** Deletes every document the app owns. Used by tests and the demo reset. */
export async function clearFirestore() {
  const store = adminDb();
  const root = store.collection(FIRESTORE_ROOT);
  const writes = [];

  for (const key of ['meta', ...CONFIG_COLLECTIONS]) {
    writes.push({ kind: 'delete', ref: root.doc(key) });
  }
  for (const key of RECORD_COLLECTIONS) {
    writes.push({ kind: 'delete', ref: root.doc(key) }); // legacy document, if any
    const docs = await readCollection(recordCollection(root, key));
    docs.forEach((doc) => {
      writes.push({ kind: 'delete', ref: recordCollection(root, key).doc(doc.id) });
    });
  }

  await commitWrites(store, root, writes);
}
