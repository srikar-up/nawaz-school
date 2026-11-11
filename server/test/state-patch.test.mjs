import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { applyServerChange, hasPatch } from '../../teacher-app/src/lib/statePatch.js';
import { applyServerChange as applyAdminChange } from '../../admin-panel/src/lib/statePatch.js';

const base = {
  meta: { revision: 4, schoolName: 'School' },
  students: [
    { id: 'S1', name: 'One' },
    { id: 'S2', name: 'Two' },
  ],
  staff: [{ id: 'T1', name: 'Teacher' }],
  announcements: [
    { id: 'A2', title: 'Newer' },
    { id: 'A1', title: 'Older' },
  ],
};

describe('client state patch', () => {
  test('both apps share the same merge behaviour', () => {
    const change = {
      meta: { revision: 5, schoolName: 'School' },
      upserts: { students: [{ id: 'S1', name: 'Updated' }] },
    };
    assert.deepEqual(applyServerChange(base, change), applyAdminChange(base, change));
  });

  test('updates existing rows and appends new ones', () => {
    const next = applyServerChange(base, {
      meta: { revision: 5 },
      upserts: { students: [{ id: 'S1', name: 'Updated' }, { id: 'S3', name: 'Three' }] },
    });
    assert.equal(next.meta.revision, 5);
    assert.deepEqual(next.students.map((row) => row.name), ['Updated', 'Two', 'Three']);
  });

  test('removes deleted rows without disturbing order', () => {
    const next = applyServerChange(base, { deletes: { students: ['S1'] } });
    assert.deepEqual(next.students.map((row) => row.id), ['S2']);
  });

  test('replaces a whole collection exactly', () => {
    const announcements = [{ id: 'A3', title: 'Newest' }];
    const next = applyServerChange(base, { collections: { announcements } });
    assert.deepEqual(next.announcements, announcements);
  });

  test('a full event is never merged', () => {
    assert.equal(applyServerChange(base, { full: true }), null);
    assert.equal(hasPatch({ full: true }), false);
    assert.equal(hasPatch({ meta: { revision: 5 } }), true);
  });

  test('the original state is not mutated', () => {
    applyServerChange(base, { upserts: { students: [{ id: 'S1', name: 'Updated' }] } });
    assert.equal(base.students[0].name, 'One');
  });
});
