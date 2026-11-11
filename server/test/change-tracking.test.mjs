import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, before, describe } from 'node:test';

const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-changes-'));
process.env.DATA_BACKEND = 'json';
process.env.DATA_DIR = DATA_DIR;
process.env.DISABLE_FILE_CACHE = 'false';

const {
  getChangesSince,
  getDb,
  getJournalBounds,
  getRevision,
  getSyncStatus,
  initStore,
  mutate,
  trackRecord,
} = await import('../src/store.js');

before(() => {
  initStore({ force: true });
});

after(() => {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

describe('mutation journal and delta patches', () => {
  test('a tracked record change emits one upsert plus meta', () => {
    const before = getRevision();
    const student = getDb().students[0];
    const nextName = `${student.name} (delta)`;

    mutate((current) => {
      const target = current.students.find((entry) => entry.id === student.id);
      target.name = nextName;
      trackRecord('students', student.id);
      current.activities.unshift({
        id: `AUD-TEST-${Date.now()}`,
        actorId: 'STF-001',
        actorName: 'Admin',
        action: 'Test',
        entity: 'Student',
        entityId: student.id,
        detail: 'delta test',
        createdAt: new Date().toISOString(),
      });
    });

    const patch = getChangesSince(before);
    assert.equal(patch.revision, before + 1);
    assert.equal(patch.full, undefined);
    assert.ok(patch.meta, 'meta should travel with every change');
    const upsert = patch.upserts.students.find((entry) => entry.id === student.id);
    assert.equal(upsert.name, nextName);
    assert.equal(patch.upserts.activities, undefined, 'audit log should not be pushed');
  });

  test('several revisions merge into one patch', () => {
    const before = getRevision();
    const first = getDb().students[0];
    const second = getDb().students[1];

    mutate((current) => {
      current.students.find((entry) => entry.id === first.id).guardianName = 'Guardian A';
      trackRecord('students', first.id);
    });
    mutate((current) => {
      current.students.find((entry) => entry.id === second.id).guardianName = 'Guardian B';
      trackRecord('students', second.id);
    });

    const patch = getChangesSince(before);
    assert.equal(patch.revision, before + 2);
    const ids = patch.upserts.students.map((entry) => entry.id);
    assert.ok(ids.includes(first.id));
    assert.ok(ids.includes(second.id));
  });

  test('a deleted record appears as a delete', () => {
    const before = getRevision();
    const student = getDb().students[2];

    mutate((current) => {
      current.students = current.students.filter((entry) => entry.id !== student.id);
      trackRecord('students', student.id, 'delete');
    });

    const patch = getChangesSince(before);
    assert.deepEqual(patch.deletes.students, [student.id]);
    assert.equal(
      (patch.upserts.students || []).some((entry) => entry.id === student.id),
      false
    );
  });

  test('a full mutation forces a refetch instead of a patch', () => {
    const before = getRevision();
    mutate((current) => {
      current.meta.schoolName = 'Patched School';
    }, { full: true });

    const patch = getChangesSince(before);
    assert.equal(patch.full, true);
    assert.equal(patch.revision, before + 1);
    assert.equal(patch.upserts, undefined);
  });

  test('an old revision outside the journal asks for a full refetch', () => {
    const patch = getChangesSince(0);
    assert.equal(patch.full, true);
  });

  test('the current revision is reported as unchanged', () => {
    const patch = getChangesSince(getRevision());
    assert.equal(patch.unchanged, true);
  });

  test('journal and sync status are bounded and observable', () => {
    const bounds = getJournalBounds();
    assert.ok(bounds.size > 0);
    assert.ok(bounds.size <= bounds.limit);
    const status = getSyncStatus();
    assert.equal(status.backend, 'local-json');
    assert.equal(status.layoutVersion, 2);
    assert.equal(status.journal.size, bounds.size);
  });
});
