import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSeed, SCHEMA_VERSION } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');
const DATABASE_FILE = path.join(DATA_DIR, 'db.json');

export const storeEvents = new EventEmitter();
storeEvents.setMaxListeners(50);

let db = null;

function persist() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tempFile = `${DATABASE_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tempFile, DATABASE_FILE);
}

function loadFromDisk() {
  try {
    if (!fs.existsSync(DATABASE_FILE)) return null;
    const raw = fs.readFileSync(DATABASE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed?.meta?.schemaVersion !== SCHEMA_VERSION) {
      console.log('[data] Schema changed — reseeding demo database.');
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('[data] Could not read db.json; reseeding.', error.message);
    return null;
  }
}

export function initStore({ force = false } = {}) {
  if (force) db = null;
  else db = loadFromDisk();

  if (!db) {
    db = buildSeed();
    persist();
    console.log(`[data] Seeded ${db.students.length} students, ${db.staff.length} staff.`);
  }
  return db;
}

export function getDb() {
  if (!db) initStore();
  return db;
}

export function getRevision() {
  return getDb().meta.revision;
}

export function mutate(mutator) {
  const current = getDb();
  mutator(current);
  current.meta.revision += 1;
  current.meta.updatedAt = new Date().toISOString();
  persist();
  storeEvents.emit('change', {
    revision: current.meta.revision,
    updatedAt: current.meta.updatedAt,
  });
  return current;
}

export function resetStore() {
  db = buildSeed();
  db.meta.revision += 1;
  persist();
  storeEvents.emit('change', {
    revision: db.meta.revision,
    updatedAt: db.meta.updatedAt,
    reset: true,
  });
  return db;
}

export function getDatabaseFile() {
  return DATABASE_FILE;
}
