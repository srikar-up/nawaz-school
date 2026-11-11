/**
 * Retention endpoint against an isolated JSON-backed API.
 *
 *   node server/test/maintenance.e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const API = 'http://127.0.0.1:4102';
const API_KEY = fs
  .readFileSync(path.join(SERVER_DIR, '.env'), 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('FIREBASE_API_KEY='))
  ?.slice('FIREBASE_API_KEY='.length);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-maintenance-'));
const children = [];

function start(command, args, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  children.push(child);
  return child;
}

function stop(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitFor(url, attempts = 80) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      /* not ready */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function signIn() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@nawazschool.edu',
        password: 'admin123',
        returnSecureToken: true,
      }),
    }
  );
  const body = await response.json();
  if (!body.idToken) throw new Error(body.error?.message || 'sign-in failed');
  return body.idToken;
}

const results = [];

try {
  start(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: '4102',
      DATA_BACKEND: 'json',
      DATA_DIR: dataDir,
      CORS_ORIGINS: 'http://127.0.0.1:5176',
      RUNTIME: '',
    },
  });
  await waitFor(`${API}/api/health`);

  const token = await signIn();
  const auth = { Authorization: `Bearer ${token}` };
  const before = await (await fetch(`${API}/api/state`, { headers: auth })).json();
  const attendancesBefore = before.attendanceSessions.length;

  const dry = await (
    await fetch(`${API}/api/maintenance/prune`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 0, dryRun: true }),
    })
  ).json();
  results.push(['dry run reports old registers', dry.attendanceRemoved > 0]);
  results.push(['dry run leaves the data untouched', (await (await fetch(`${API}/api/state`, { headers: auth })).json()).attendanceSessions.length === attendancesBefore]);

  const committed = await (
    await fetch(`${API}/api/maintenance/prune`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ retentionDays: 0, dryRun: false }),
    })
  ).json();
  results.push(['commit reports the same count', committed.attendanceRemoved === dry.attendanceRemoved]);

  const after = await (await fetch(`${API}/api/state`, { headers: auth })).json();
  results.push([
    'old registers are gone',
    after.attendanceSessions.length === attendancesBefore - committed.attendanceRemoved,
  ]);
  results.push(['the revision advances', after.meta.revision > before.meta.revision]);
  results.push([
    'the audit log records the prune',
    (after.activities || []).some((entry) => entry.action === 'Pruned old school data'),
  ]);
} finally {
  for (const child of children) stop(child);
  await new Promise((resolve) => setTimeout(resolve, 700));
  fs.rmSync(dataDir, { recursive: true, force: true });
}

let pass = true;
for (const [label, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) pass = false;
}
console.log(`RESULT: ${JSON.stringify({ pass, checks: results.length })}`);
process.exit(pass ? 0 : 1);
