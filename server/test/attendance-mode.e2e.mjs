/**
 * Attendance-mode enforcement, against an isolated API instance.
 *
 * Spawns its own server on port 4100 with a temporary JSON database, so the
 * real Firestore data is never touched:
 *
 *   node server/test/attendance-mode.e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const PORT = process.env.TEST_PORT || '4100';
const API = `http://127.0.0.1:${PORT}`;
const API_KEY = fs
  .readFileSync(path.join(SERVER_DIR, '.env'), 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('FIREBASE_API_KEY='))
  ?.slice('FIREBASE_API_KEY='.length);

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-attendance-'));

const child = spawn(process.execPath, ['src/index.js'], {
  cwd: SERVER_DIR,
  env: {
    ...process.env,
    PORT,
    DATA_BACKEND: 'json',
    DATA_DIR: dataDir,
    CORS_ORIGINS: 'http://localhost:5173',
    RUNTIME: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (chunk) => process.stdout.write(`[api] ${chunk}`));
child.stderr.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));

async function waitForApi() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${API}/api/health`);
      if (response.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('Test API did not start.');
}

async function signIn(email, password) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
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

async function call(pathname, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, body: payload };
}

const results = [];

try {
  await waitForApi();

  const adminToken = await signIn('admin@nawazschool.edu', 'admin123');
  const state = (await call('/api/state', { token: adminToken })).body;
  const cls = state.classes[0];
  const roster = state.students.filter((student) => student.classIdSection === cls.id).slice(0, 3);

  console.log(`class ${cls.id} · roster ${roster.length} · mode ${state.meta.attendanceMode}`);

  const entries = roster.map((student) => ({ studentId: student.id, status: 'present' }));
  const payload = (sessionType, date) => ({
    classIdSection: cls.id,
    date,
    sessionType,
    entries,
  });

  // Seed mode is two sessions.
  const before = (await call('/api/state', { token: adminToken })).body.attendanceSessions.length;

  const fullDayRejected = await call('/api/attendance', {
    method: 'POST',
    token: adminToken,
    body: payload('FullDay', '2026-02-02'),
  });
  results.push(['twoSessions rejects FullDay', fullDayRejected.status === 400]);

  const morningAccepted = await call('/api/attendance', {
    method: 'POST',
    token: adminToken,
    body: payload('Morning', '2026-02-02'),
  });
  results.push(['twoSessions accepts Morning', morningAccepted.status === 200]);

  const afternoonAccepted = await call('/api/attendance', {
    method: 'POST',
    token: adminToken,
    body: payload('Afternoon', '2026-02-02'),
  });
  results.push(['twoSessions accepts Afternoon', afternoonAccepted.status === 200]);

  // Switch to a single full-day register.
  const toFullDay = await call('/api/meta', {
    method: 'PATCH',
    token: adminToken,
    body: { attendanceMode: 'fullDay' },
  });
  results.push(['admin can switch to fullDay', toFullDay.status === 200 && toFullDay.body.meta.attendanceMode === 'fullDay']);

  const morningRejected = await call('/api/attendance', {
    method: 'POST',
    token: adminToken,
    body: payload('Morning', '2026-02-03'),
  });
  results.push([
    'fullDay rejects Morning',
    morningRejected.status === 400 && /full-day/i.test(morningRejected.body?.error || ''),
  ]);

  const fullDayAccepted = await call('/api/attendance', {
    method: 'POST',
    token: adminToken,
    body: payload('FullDay', '2026-02-03'),
  });
  results.push([
    'fullDay accepts FullDay',
    fullDayAccepted.status === 200 && fullDayAccepted.body?.attendance?.sessionType === 'FullDay',
  ]);

  const invalidMode = await call('/api/meta', {
    method: 'PATCH',
    token: adminToken,
    body: { attendanceMode: 'weekly' },
  });
  results.push(['invalid mode is rejected', invalidMode.status === 400]);

  const after = (await call('/api/state', { token: adminToken })).body.attendanceSessions.length;
  results.push(['rejected submissions write nothing', after === before + 3]);
} finally {
  child.kill();
  await new Promise((resolve) => setTimeout(resolve, 400));
  fs.rmSync(dataDir, { recursive: true, force: true });
}

let pass = true;
for (const [label, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) pass = false;
}
console.log(`RESULT: ${JSON.stringify({ pass, checks: results.length })}`);
process.exit(pass ? 0 : 1);
