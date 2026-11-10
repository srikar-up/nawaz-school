/**
 * End-to-end proof of the Google sign-in identity path, against the deployed API.
 *
 * A Google user has a random uid, so the API must resolve the staff record by
 * verified email. This test reproduces exactly those claims with throwaway
 * Firebase users (same token shape, no Google account needed) and cleans up.
 *
 *   node server/test/google-mapping.e2e.mjs
 */
import { adminAuth } from '../src/firebase.js';

const API = process.env.API_URL || 'https://nawaz-school-api.srikarsensai.workers.dev';
const API_KEY =
  process.env.FIREBASE_API_KEY ||
  (await import('node:fs'))
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .find((line) => line.startsWith('FIREBASE_API_KEY='))
    ?.slice('FIREBASE_API_KEY='.length);

const suffix = Date.now();
const email = `google-probe-${suffix}@nawazschool.edu`;
const unverifiedEmail = `google-unverified-${suffix}@nawazschool.edu`;
const uid = `google-probe-${suffix}`;
const unverifiedUid = `google-unverified-${suffix}`;

async function idpSignIn(address, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: address, password, returnSecureToken: true }),
    }
  );
  const body = await response.json();
  if (!body.idToken) throw new Error(body.error?.message || 'sign-in failed');
  return body.idToken;
}

async function call(pathname, options = {}, token) {
  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

let staffId = null;
let unverifiedStaffId = null;

try {
  const adminToken = await idpSignIn('admin@nawazschool.edu', 'admin123');

  const created = await call(
    '/api/staff',
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Google Probe',
        email,
        staffType: 'Teacher',
        department: 'Science',
        accessLevel: 'TeacherApp',
      }),
    },
    adminToken
  );
  if (created.status !== 201) throw new Error(`create staff failed: ${JSON.stringify(created.body)}`);
  staffId = created.body.staff.id;

  const unverifiedCreated = await call(
    '/api/staff',
    {
      method: 'POST',
      body: JSON.stringify({
        name: 'Unverified Probe',
        email: unverifiedEmail,
        staffType: 'Teacher',
        department: 'Science',
        accessLevel: 'TeacherApp',
      }),
    },
    adminToken
  );
  unverifiedStaffId = unverifiedCreated.body?.staff?.id;

  // Two Firebase users whose uid is NOT a staff id, mirroring Google sign-in.
  await adminAuth().createUser({
    uid,
    email,
    emailVerified: true,
    password: `Probe-${suffix}!`,
  });
  await adminAuth().createUser({
    uid: unverifiedUid,
    email: unverifiedEmail,
    emailVerified: false,
    password: `Probe-${suffix}!`,
  });

  const verifiedToken = await idpSignIn(email, `Probe-${suffix}!`);
  const verified = await call('/api/me', {}, verifiedToken);
  console.log(
    'verified email ->',
    verified.status,
    verified.body?.user?.id,
    verified.body?.user?.email
  );

  const unverifiedToken = await idpSignIn(unverifiedEmail, `Probe-${suffix}!`);
  const unverified = await call('/api/me', {}, unverifiedToken);
  console.log('unverified email ->', unverified.status, unverified.body?.error);

  const unknownUser = await adminAuth().createUser({
    uid: `google-stranger-${suffix}`,
    email: `google-stranger-${suffix}@example.com`,
    emailVerified: true,
    password: `Probe-${suffix}!`,
  });
  const strangerToken = await idpSignIn(`google-stranger-${suffix}@example.com`, `Probe-${suffix}!`);
  const stranger = await call('/api/me', {}, strangerToken);
  console.log('unknown email ->', stranger.status, stranger.body?.error);
  await adminAuth().deleteUser(unknownUser.uid);

  const pass =
    verified.status === 200 &&
    verified.body?.user?.id === staffId &&
    unverified.status === 403 &&
    stranger.status === 403;
  console.log('RESULT:', JSON.stringify({ pass }));
  process.exitCode = pass ? 0 : 1;
} finally {
  await adminAuth().deleteUser(uid).catch(() => {});
  await adminAuth().deleteUser(unverifiedUid).catch(() => {});

  const adminToken = await idpSignIn('admin@nawazschool.edu', 'admin123').catch(() => null);
  for (const id of [staffId, unverifiedStaffId]) {
    if (id && adminToken) await call(`/api/staff/${id}`, { method: 'DELETE' }, adminToken);
  }
}
