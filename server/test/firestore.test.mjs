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
const { clearFirestore, loadDbFromFirestore, saveDbToFirestore, COLLECTION_KEYS, FIRESTORE_ROOT } =
  await import('../src/firestore-store.js');

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

after(async () => {
  await clearFirestore();
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
});

describe('Firestore persistence layer', () => {
  test('keeps every document under the 1 MiB limit', () => {
    const seed = buildSeed();
    for (const key of COLLECTION_KEYS) {
      const bytes = Buffer.byteLength(JSON.stringify({ items: seed[key] }), 'utf8');
      assert.ok(
        bytes < ONE_MIB,
        `${key} document is ${bytes} bytes, over Firestore's 1 MiB cap`
      );
    }
  });

  test('round-trips every collection without loss', async () => {
    await clearFirestore();
    const seed = buildSeed();

    const writes = await saveDbToFirestore(seed, null);
    assert.equal(writes, COLLECTION_KEYS.length + 1, 'should write meta plus every collection');

    const loaded = await loadDbFromFirestore();
    assert.ok(loaded, 'expected a stored database');

    for (const key of COLLECTION_KEYS) {
      assert.deepEqual(loaded[key], seed[key], `${key} changed during round-trip`);
    }
    assert.equal(loaded.meta.schemaVersion, seed.meta.schemaVersion);
    assert.equal(loaded.meta.revision, seed.meta.revision);
  });

  test('writes only the collections that changed', async () => {
    const before = await loadDbFromFirestore();

    const after1 = structuredClone(before);
    after1.students[0].name = 'Modified Student';
    const writes = await saveDbToFirestore(after1, before);
    assert.equal(writes, 1, 'only the students document should be rewritten');

    const unchanged = await saveDbToFirestore(after1, after1);
    assert.equal(unchanged, 0, 'no-op save must not write anything');

    const reloaded = await loadDbFromFirestore();
    assert.equal(reloaded.students[0].name, 'Modified Student');
    assert.equal(reloaded.staff.length, before.staff.length);
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
