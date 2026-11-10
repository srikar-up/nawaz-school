/**
 * Verifies that deleting a staff/student record also removes the Cloudinary
 * asset, so no orphaned media is left behind.
 *
 * Run against a live API: node server/test/photo-cleanup.e2e.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = process.env.API_URL || 'http://localhost:4000';

const envFile = path.join(ROOT, 'teacher-app', '.env.local');
const env = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    })
);

const EMAIL = 'cleanup-test@nawazschool.edu';

async function signIn(email, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );
  const body = await response.json();
  if (!body.idToken) throw new Error(body.error?.message || 'sign-in failed');
  return body.idToken;
}

const token = await signIn('admin@nawazschool.edu', 'admin123');
const auth = { Authorization: `Bearer ${token}` };

async function call(pathname, options = {}) {
  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...auth,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${options.method || 'GET'} ${pathname} -> ${response.status} ${JSON.stringify(body)}`);
  return body;
}

// 1. Create a throwaway staff record.
const created = await call('/api/staff', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Cleanup Probe',
    email: EMAIL,
    staffType: 'Teacher',
    department: 'Science',
    accessLevel: 'TeacherApp',
  }),
});
const id = created.staff.id;
console.log('created staff:', id);

// 2. Signed upload of a real asset under that record's public id.
const signed = await call('/api/auth/cloudinary-sign', {
  method: 'POST',
  body: JSON.stringify({ kind: 'staff', id }),
});

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const form = new FormData();
form.append('file', new Blob([png], { type: 'image/png' }), 'probe.png');
form.append('api_key', signed.apiKey);
form.append('timestamp', String(signed.timestamp));
form.append('public_id', signed.publicId);
form.append('overwrite', String(signed.overwrite));
form.append('invalidate', String(signed.invalidate));
form.append('signature', signed.signature);

const uploaded = await fetch(signed.uploadUrl, { method: 'POST', body: form }).then((r) => r.json());
if (!uploaded.secure_url) throw new Error(`upload failed: ${JSON.stringify(uploaded)}`);
console.log('uploaded:', uploaded.secure_url);

await call(`/api/staff/${id}/photo`, {
  method: 'PATCH',
  body: JSON.stringify({ url: uploaded.secure_url, publicId: uploaded.public_id }),
});

const before = await fetch(uploaded.secure_url, { method: 'HEAD' });
console.log('asset before delete:', before.status, before.status === 200 ? 'OK' : 'UNEXPECTED');

// 3. Delete the record; the asset must follow.
await call(`/api/staff/${id}`, { method: 'DELETE' });
console.log('record deleted:', id);

let after = null;
for (let attempt = 0; attempt < 10; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  after = await fetch(uploaded.secure_url, { method: 'HEAD' });
  if (after.status === 404) break;
}
console.log('asset after delete:', after.status, after.status === 404 ? 'REMOVED' : 'STILL PRESENT');

const state = await call('/api/state');
console.log('record still listed:', state.staff.some((member) => member.id === id));

if (after.status !== 404) process.exit(1);
