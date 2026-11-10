/**
 * Identity mapping: which staff record does a verified token belong to?
 *
 * Plain node:test - no Firebase and no network.
 *   node --test server/test/auth-mapping.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveStaff } from '../src/auth.js';

const db = {
  staff: [
    { id: 'STF-001', email: 'admin@nawazschool.edu', isActive: true },
    { id: 'STF-002', email: 'teacher@nawazschool.edu', isActive: true },
    { id: 'STF-003', email: 'IMRAN@nawazschool.edu', isActive: true },
  ],
};

test('password accounts resolve by uid', () => {
  assert.equal(resolveStaff(db, { uid: 'STF-002', email: 'teacher@nawazschool.edu' }).id, 'STF-002');
});

test('uid wins over a different email', () => {
  assert.equal(resolveStaff(db, { uid: 'STF-001', email: 'teacher@nawazschool.edu' }).id, 'STF-001');
});

test('google accounts resolve by verified email', () => {
  const actor = resolveStaff(db, {
    uid: 'google-uid-123',
    email: 'teacher@nawazschool.edu',
    email_verified: true,
  });
  assert.equal(actor.id, 'STF-002');
});

test('email matching is case-insensitive', () => {
  const actor = resolveStaff(db, {
    uid: 'google-uid-456',
    email: 'imran@nawazschool.edu',
    email_verified: true,
  });
  assert.equal(actor.id, 'STF-003');
});

test('an unverified email is never trusted', () => {
  assert.equal(
    resolveStaff(db, {
      uid: 'google-uid-789',
      email: 'teacher@nawazschool.edu',
      email_verified: false,
    }),
    null
  );
});

test('an unknown email has no staff profile', () => {
  assert.equal(
    resolveStaff(db, { uid: 'google-uid-999', email: 'stranger@gmail.com', email_verified: true }),
    null
  );
});

test('missing claims resolve to nothing', () => {
  assert.equal(resolveStaff(db, {}), null);
  assert.equal(resolveStaff(db, undefined), null);
});
