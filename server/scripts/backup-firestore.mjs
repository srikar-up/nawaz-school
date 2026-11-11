#!/usr/bin/env node
/**
 * Copies the 15 layout-v1 documents from FIRESTORE_ROOT into a timestamped
 * backup collection before a migration.
 *
 *   node --env-file-if-exists=server/.env server/scripts/backup-firestore.mjs
 */
import { adminDb } from '../src/firebase.js';

const sourceRoot = process.env.FIRESTORE_ROOT || 'school';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = `${sourceRoot}_backup_${stamp}`;
const source = adminDb().collection(sourceRoot);
const target = adminDb().collection(backupRoot);

const keys = [
  'meta',
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

const meta = await source.doc('meta').get();
if (!meta.exists) {
  console.log(`No ${sourceRoot}/meta document; nothing to back up.`);
  process.exit(0);
}

const batch = adminDb().batch();
let copied = 0;
for (const key of keys) {
  const snapshot = await source.doc(key).get();
  if (!snapshot.exists) continue;
  batch.set(target.doc(key), snapshot.data());
  copied += 1;
}
await batch.commit();
console.log(
  JSON.stringify({
    backup: backupRoot,
    layoutVersion: meta.data().layoutVersion || 1,
    documents: copied,
  })
);
