/**
 * Creates Firebase Auth accounts for the demo staff.
 *
 * The Firebase UID is set to the staff id (STF-001, ...) so the server can map
 * a verified ID token straight onto a staff record - no lookup table, no way for
 * a client to claim someone else's identity.
 *
 * Idempotent: existing users are left untouched.
 *
 * Usage: npm --workspace server run create:users
 */
import { adminAuth } from '../src/firebase.js';
import { getDb, initStoreAsync } from '../src/store.js';

const ACCOUNTS = [
  { staffId: 'STF-001', email: 'admin@nawazschool.edu', password: 'admin123' },
  { staffId: 'STF-007', email: 'subadmin@nawazschool.edu', password: 'subadmin123' },
  { staffId: 'STF-002', email: 'teacher@nawazschool.edu', password: 'teacher123' },
  { staffId: 'STF-003', email: 'imran@nawazschool.edu', password: 'teacher123' },
  { staffId: 'STF-004', email: 'ayesha@nawazschool.edu', password: 'teacher123' },
  { staffId: 'STF-005', email: 'bilal@nawazschool.edu', password: 'teacher123' },
];

await initStoreAsync();
const db = getDb();
const auth = adminAuth();

let created = 0;
let skipped = 0;
let failed = 0;

for (const account of ACCOUNTS) {
  const staff = db.staff.find((member) => member.id === account.staffId);
  if (!staff) {
    console.warn(`- ${account.staffId}: no such staff record, skipped`);
    skipped += 1;
    continue;
  }

  try {
    await auth.getUser(account.staffId);
    console.log(`= ${account.staffId} <${staff.email}> already exists`);
    skipped += 1;
  } catch {
    try {
      await auth.createUser({
        uid: account.staffId,
        email: staff.email,
        password: account.password,
        displayName: staff.name,
        emailVerified: true,
      });
      console.log(`+ ${account.staffId} <${staff.email}> created`);
      created += 1;
    } catch (error) {
      console.error(`! ${account.staffId}: ${error.message}`);
      failed += 1;
    }
  }
}

console.log(`\ncreated ${created}, skipped ${skipped}, failed ${failed}`);
process.exit(failed > 0 ? 1 : 0);
