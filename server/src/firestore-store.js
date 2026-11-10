import { adminDb } from './firebase.js';

/**
 * Firestore persistence for the Express API.
 *
 * The browser never touches Firestore - this module is the only writer, and it
 * runs on the server through the Firebase Admin SDK (which bypasses rules).
 *
 * Layout: one document per top-level key, all under `school/`.
 *   school/meta                 <- { schemaVersion, revision, updatedAt }
 *   school/students             <- { items: [...] }
 *   school/staff                <- { items: [...] }
 *   ...
 *
 * Documents rather than one big blob because a Firestore document caps at 1 MiB
 * and the seeded database is already ~345 KB.
 */
export const FIRESTORE_ROOT = 'school';

export const COLLECTION_KEYS = [
  'staff',
  'classes',
  'students',
  'subjects',
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

export function isFirestoreEnabled() {
  return String(process.env.DATA_BACKEND || '').toLowerCase() === 'firestore';
}

/** Returns the stored database, or null when Firestore has never been seeded. */
export async function loadDbFromFirestore() {
  const root = adminDb().collection(FIRESTORE_ROOT);
  const metaSnap = await root.doc('meta').get();
  if (!metaSnap.exists) return null;

  const snaps = await Promise.all(COLLECTION_KEYS.map((key) => root.doc(key).get()));

  const result = { meta: metaSnap.data() };
  COLLECTION_KEYS.forEach((key, index) => {
    result[key] = snaps[index].exists ? snaps[index].data().items ?? [] : [];
  });
  return result;
}

/**
 * Writes only the keys that changed since the last sync.
 * @param {object} db current in-memory database
 * @param {object|null} previous snapshot taken after the last successful sync
 */
export async function saveDbToFirestore(db, previous) {
  const store = adminDb();
  const root = store.collection(FIRESTORE_ROOT);
  const batch = store.batch();

  let writes = 0;

  for (const key of ['meta', ...COLLECTION_KEYS]) {
    const next = db[key];
    const prev = previous ? previous[key] : undefined;
    if (previous && JSON.stringify(next) === JSON.stringify(prev)) continue;

    const ref = root.doc(key);
    if (key === 'meta') batch.set(ref, { ...next });
    else batch.set(ref, { items: next });
    writes += 1;
  }

  if (writes > 0) await batch.commit();
  return writes;
}

/** Deletes every document the app owns. Used by the /api/reset endpoint. */
export async function clearFirestore() {
  const store = adminDb();
  const root = store.collection(FIRESTORE_ROOT);
  const batch = store.batch();
  for (const key of ['meta', ...COLLECTION_KEYS]) batch.delete(root.doc(key));
  await batch.commit();
}
