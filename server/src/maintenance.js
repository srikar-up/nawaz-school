/**
 * Retention helpers.
 *
 * Attendance is stored one document per class/date/session. Keeping every
 * register forever makes cold starts progressively more expensive, so a school
 * can choose a retention window with ATTENDANCE_RETENTION_DAYS. The default is
 * 0 (keep everything); pruning is also available as an explicit SuperAdmin
 * action with a dry-run preview.
 */

export function isoDaysAgo(days, now = new Date()) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - Math.max(0, Number(days) || 0));
  return date.toISOString().slice(0, 10);
}

/**
 * Removes attendance sessions strictly before `cutoff` (YYYY-MM-DD).
 * Returns the removed sessions so the caller can write per-record deletes.
 */
export function pruneAttendanceRecords(db, cutoff) {
  if (!cutoff || !Array.isArray(db.attendanceSessions)) return [];
  const keep = [];
  const removed = [];
  for (const session of db.attendanceSessions) {
    if (String(session.date) < cutoff) removed.push(session);
    else keep.push(session);
  }
  if (removed.length) db.attendanceSessions = keep;
  return removed;
}

/** Keeps the audit log bounded (newest first). */
export function pruneActivityRecords(db, limit = 150) {
  if (!Array.isArray(db.activities)) return 0;
  const cap = Math.max(1, Number(limit) || 150);
  if (db.activities.length <= cap) return 0;
  const removed = db.activities.length - cap;
  db.activities = db.activities.slice(0, cap);
  return removed;
}
