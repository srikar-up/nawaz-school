/**
 * Child-process probe used by the Firestore architecture tests.
 *
 * Runs in its own process so the module-level singleton in store.js starts clean,
 * which is the only way to test boot behaviour (seed vs. load).
 *
 * Usage: node boot-probe.mjs <read|mutate|corrupt-schema>
 * Prints a single JSON line describing the resulting state.
 */
import { flushStore, getBackendName, getDb, initStoreAsync, mutate } from '../../src/store.js';

const command = process.argv[2] || 'read';

const db = await initStoreAsync();
await flushStore();

if (command === 'mutate') {  for (let index = 0; index < 5; index += 1) {
    mutate((current) => {
      current.meta.lastMutation = `mutation-${index}`;
    });
  }
  await flushStore();
}

if (command === 'corrupt-schema') {
  mutate((current) => {
    current.meta.schemaVersion = 999;
  });
  await flushStore();
}

const state = getDb();

process.stdout.write(
  JSON.stringify({
    backend: getBackendName(),
    revision: state.meta.revision,
    students: state.students.length,
    staff: state.staff.length,
    createdAt: state.meta.createdAt,
    lastMutation: state.meta.lastMutation ?? null,
    schemaVersion: state.meta.schemaVersion,
  }) + '\n'
);

process.exit(0);
