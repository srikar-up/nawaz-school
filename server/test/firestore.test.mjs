import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after, describe } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = path.resolve(__dirname, '..');
const PROBE = path.join(__dirname, 'helpers', 'boot-probe.mjs');

// Isolated namespace so tests never touch the real `school` data.
const ROOT = `school_test_${Date.now()}_${process.pid}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-dbtest-'));

process.env.FIRESTORE_ROOT = ROOT;
process.env.DATA_BACKEND = 'firestore';
process.env.DATA_DIR = DATA_DIR;

const { buildSeed } = await import('../src/seed.js');
const {
  clearFirestore,
  loadDbFromFirestore,
  saveDbToFirestore,
  assertDocumentSize,
  COLLECTION_KEYS,
  CONFIG_COLLECTIONS,
  RECORD_COLLECTIONS,
  FIRESTORE_ROOT,
  MAX_DOCUMENT_BYTES,
} = await import('../src/firestore-store.js');
const { adminDb } = await import('../src/firebase.js');

const ONE_MIB = 1024 * 1024;

function runProbe(command) {
  const result = spawnSync(process.execPath, [PROBE, command], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      DATA_BACKEND: 'firestore',
      FIRESTORE_ROOT: ROOT,
      DATA_DIR,
      NODE_NO_WARNINGS: '1',
    },
    encoding: 'utf8',
    timeout: 90_000,
  });

  if (result.status !== 0) {
    throw new Error(`probe "${command}" failed (${result.status}):\n${result.stderr}`);
  }

  const line = result.stdout.trim().split('\n').filter(Boolean).pop();
  return JSON.parse(line);
}

function changesFor(collection, ids) {
  return {
    full: false,
    collections: new Set(['meta']),
    records: new Map([[collection, new Map(ids.map((id) => [id, 'set']))]]),
  };
}

after(async () => {
  await clearFirestore();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

describe('Firestore persistence layer', () => {
  test('keeps every document under the 1 MiB limit', () => {
    const seed = buildSeed();
    for (const key of COLLECTION_KEYS) {
      const value = RECORD_COLLECTIONS.includes(key) ? seed[key][0] : { items: seed[key] };
      const bytes = Buffer.byteLength(JSON.stringify(value), 'utf8');
      assert.ok(
        bytes < ONE_MIB,
        `${key} document is ${bytes} bytes, over Firestore's 1 MiB cap`
      );
    }
  });

  test('round-trips every collection without loss', async () => {
    await clearFirestore();
    const seed = buildSeed();

    const written = await saveDbToFirestore(seed, null);
    const recordRows = RECORD_COLLECTIONS.reduce(
      (sum, key) => sum + (seed[key]?.length || 0),
      0
    );
    assert.equal(
      written.writes,
      CONFIG_COLLECTIONS.length + recordRows + 1,
      'should write meta, every config collection and one document per record'
    );
    assert.equal(written.deletes, RECORD_COLLECTIONS.length, 'should remove legacy documents');

    const loaded = await loadDbFromFirestore();
    assert.ok(loaded, 'expected a stored database');

    for (const key of COLLECTION_KEYS) {
      if (RECORD_COLLECTIONS.includes(key)) {
        const byId = (rows) => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
        assert.deepEqual(byId(loaded[key]), byId(seed[key]), `${key} changed during round-trip`);
      } else {
        assert.deepEqual(loaded[key], seed[key], `${key} changed during round-trip`);
      }
    }
    assert.equal(loaded.meta.schemaVersion, seed.meta.schemaVersion);
    assert.equal(loaded.meta.revision, seed.meta.revision);
    assert.equal(loaded.meta.layoutVersion, 2);
  });

  test('stores high-growth collections as one document per record', async () => {
    const root = adminDb().collection(FIRESTORE_ROOT);
    const seed = buildSeed();

    for (const key of RECORD_COLLECTIONS) {
      const sample = seed[key][0];
      if (!sample) continue;
      const record = await root.doc('records').collection(key).doc(sample.id).get();
      assert.ok(record.exists, `${key}/${sample.id} was not stored per-record`);
      const legacy = await root.doc(key).get();
      assert.equal(legacy.exists, false, `${key} legacy document still exists`);
    }
    const config = await root.doc('staff').get();
    assert.ok(config.exists, 'small collections should stay in one document');
  });

  test('writes only the record that changed', async () => {
    const before = await loadDbFromFirestore();
    const changedStudent = before.students[0];
    const untouchedStudent = before.students[1];

    const after1 = structuredClone(before);
    after1.students[0].name = 'Modified Student';
    after1.meta.revision += 1;
    after1.meta.updatedAt = new Date().toISOString();
    const written = await saveDbToFirestore(
      after1,
      before,
      changesFor('students', [changedStudent.id])
    );
    assert.equal(written.writes, 2, 'only the student and meta documents should be written');
    assert.equal(written.deletes, 0);

    const root = adminDb().collection(FIRESTORE_ROOT);
    const changedDoc = await root.doc('records').collection('students').doc(changedStudent.id).get();
    assert.equal(changedDoc.data().name, 'Modified Student');
    const untouchedDoc = await root.doc('records').collection('students').doc(untouchedStudent.id).get();
    assert.equal(untouchedDoc.data().name, untouchedStudent.name);

    const unchanged = await saveDbToFirestore(after1, after1);
    assert.equal(unchanged.writes, 0, 'no-op save must not write anything');
  });

  test('deletes records removed from a collection', async () => {
    const before = await loadDbFromFirestore();
    const removed = before.students[0];
    const after1 = structuredClone(before);
    after1.students = after1.students.filter((student) => student.id !== removed.id);
    after1.meta.revision += 1;
    after1.meta.updatedAt = new Date().toISOString();

    const written = await saveDbToFirestore(after1, before, {
      full: false,
      collections: new Set(['meta']),
      records: new Map([['students', new Map([[removed.id, 'delete']])]]),
    });
    assert.equal(written.deletes, 1);

    const root = adminDb().collection(FIRESTORE_ROOT);
    const deleted = await root.doc('records').collection('students').doc(removed.id).get();
    assert.equal(deleted.exists, false);

    const loaded = await loadDbFromFirestore();
    assert.equal(loaded.students.length, before.students.length - 1);
  });

  test('migrates the legacy one-document layout', async () => {
    await clearFirestore();
    const seed = buildSeed();
    const root = adminDb().collection(FIRESTORE_ROOT);
    const store = adminDb();
    const batch = store.batch();
    batch.set(root.doc('meta'), { ...seed.meta, layoutVersion: 1 });
    for (const key of COLLECTION_KEYS) batch.set(root.doc(key), { items: seed[key] });
    await batch.commit();

    const legacy = await loadDbFromFirestore();
    assert.equal(legacy.meta.layoutVersion, 1);
    assert.equal(legacy.students.length, seed.students.length);

    const migrated = await saveDbToFirestore(legacy, null);
    assert.equal(migrated.migrated, true);

    const loaded = await loadDbFromFirestore();
    assert.equal(loaded.meta.layoutVersion, 2);
    assert.equal(loaded.students.length, seed.students.length);
    const byId = (rows) => [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    assert.deepEqual(byId(loaded.testRecords), byId(seed.testRecords));
    for (const key of RECORD_COLLECTIONS) {
      const doc = await root.doc(key).get();
      assert.equal(doc.exists, false, `${key} legacy document was not deleted`);
    }
  });

  test('rejects a document over the safety limit', () => {
    const tooBig = { items: [{ body: 'x'.repeat(MAX_DOCUMENT_BYTES + 1) }] };
    assert.throws(() => assertDocumentSize('school/huge', tooBig), /safety limit/);
  });

  test('load returns null for an empty namespace', async () => {
    await clearFirestore();
    assert.equal(await loadDbFromFirestore(), null);
  });
});

describe('server boot semantics', () => {
  test('seeds an empty namespace, then reloads instead of reseeding', async () => {
    await clearFirestore();

    const first = runProbe('read');
    assert.equal(first.backend, 'firestore');
    assert.equal(first.students, 56);
    assert.equal(first.staff, 12);

    const second = runProbe('read');
    assert.equal(second.students, 56);
    assert.equal(
      second.createdAt,
      first.createdAt,
      'createdAt changed, which means the database was reseeded instead of loaded'
    );
    assert.equal(second.revision, first.revision);
  });

  test('mutations persist and survive a restart', async () => {
    const before = runProbe('read');

    const mutated = runProbe('mutate');
    assert.equal(mutated.revision, before.revision + 5, 'expected five revisions');
    assert.equal(mutated.lastMutation, 'mutation-4', 'concurrent writes lost the final update');

    const reloaded = runProbe('read');
    assert.equal(reloaded.revision, mutated.revision);
    assert.equal(reloaded.lastMutation, 'mutation-4', 'mutation did not survive restart');
  });

  test('falls back to local JSON when the schema version is unknown', async () => {
    const healthy = runProbe('read');

    runProbe('corrupt-schema');

    const after = runProbe('read');
    assert.equal(after.schemaVersion, healthy.schemaVersion, 'schema version was not reset');
    assert.equal(after.students, 56);
  });

  test('uses an isolated namespace', () => {
    assert.match(FIRESTORE_ROOT, /^school_test_/);
  });
});
