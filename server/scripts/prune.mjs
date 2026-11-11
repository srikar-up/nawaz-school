#!/usr/bin/env node
/**
 * Retention maintenance.
 *
 *   node --env-file-if-exists=server/.env server/scripts/prune.mjs --days 365
 *   node --env-file-if-exists=server/.env server/scripts/prune.mjs --before 2026-01-01 --yes
 *
 * It is a dry run unless `--yes` is passed. Attendance is deleted per record so
 * the Firestore write stays small; the audit log is capped separately.
 */
import {
  flushStore,
  getDb,
  initStoreAsync,
  mutate,
  trackRecord,
} from '../src/store.js';
import { isoDaysAgo, pruneActivityRecords } from '../src/maintenance.js';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

const days = Number(arg('days', '365'));
const before = arg('before', '');
const activityLimit = Math.max(Number(arg('activities', '150')) || 150, 1);
const yes = process.argv.includes('--yes');

if (!Number.isFinite(days) || days < 0) {
  console.error('--days must be zero or a positive number.');
  process.exit(1);
}

const cutoff = before || isoDaysAgo(days);
if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)) {
  console.error('--before must use YYYY-MM-DD.');
  process.exit(1);
}

await initStoreAsync();
const db = getDb();
const attendance = db.attendanceSessions.filter((session) => String(session.date) < cutoff);
const activities = Math.max(0, db.activities.length - activityLimit);

console.log(
  `${yes ? 'Pruning' : 'Would prune'} ${attendance.length} attendance register(s) before ${cutoff} and cap the audit log at ${activityLimit} (${activities} row(s) removed).`
);

if (!yes) {
  console.log('Dry run only. Add --yes to write the deletion.');
  process.exit(0);
}

if (!attendance.length && !activities) {
  console.log('Nothing to prune.');
  process.exit(0);
}

mutate((current) => {
  const removed = current.attendanceSessions.filter(
    (session) => String(session.date) < cutoff
  );
  current.attendanceSessions = current.attendanceSessions.filter(
    (session) => String(session.date) >= cutoff
  );
  removed.forEach((session) => trackRecord('attendanceSessions', session.id, 'delete'));
  pruneActivityRecords(current, activityLimit);
});

await flushStore();
console.log(`Pruned. Revision is now ${getDb().meta.revision}.`);
