import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  isoDaysAgo,
  pruneActivityRecords,
  pruneAttendanceRecords,
} from '../src/maintenance.js';

describe('retention helpers', () => {
  test('isoDaysAgo returns a date-only cutoff', () => {
    assert.match(isoDaysAgo(30, new Date('2026-11-11T00:00:00Z')), /^2026-10-12$/);
  });

  test('pruneAttendanceRecords removes only old dates', () => {
    const db = {
      attendanceSessions: [
        { id: 'old', date: '2026-01-01' },
        { id: 'keep', date: '2026-10-01' },
        { id: 'new', date: '2026-11-01' },
      ],
    };
    const removed = pruneAttendanceRecords(db, '2026-09-01');
    assert.deepEqual(removed.map((entry) => entry.id), ['old']);
    assert.deepEqual(db.attendanceSessions.map((entry) => entry.id), ['keep', 'new']);
  });

  test('a missing cutoff is a no-op', () => {
    const db = { attendanceSessions: [{ id: 'a', date: '2026-01-01' }] };
    assert.deepEqual(pruneAttendanceRecords(db, ''), []);
    assert.equal(db.attendanceSessions.length, 1);
  });

  test('pruneActivityRecords keeps the newest rows', () => {
    const db = { activities: Array.from({ length: 10 }, (_, index) => ({ id: index })) };
    assert.equal(pruneActivityRecords(db, 3), 7);
    assert.deepEqual(db.activities.map((entry) => entry.id), [0, 1, 2]);
  });
});
