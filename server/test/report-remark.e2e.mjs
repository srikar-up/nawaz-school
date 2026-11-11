/**
 * Teacher-authored progress remarks against an isolated JSON API.
 *
 *   node server/test/report-remark.e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const API = 'http://127.0.0.1:4104';
const API_KEY = fs
  .readFileSync(path.join(SERVER_DIR, '.env'), 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('FIREBASE_API_KEY='))
  ?.slice('FIREBASE_API_KEY='.length);
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-remarks-'));
const children = [];

const ACCOUNTS = {
  teacher: ['teacher@nawazschool.edu', 'teacher123'],
  imran: ['imran@nawazschool.edu', 'teacher123'],
  ayesha: ['ayesha@nawazschool.edu', 'teacher123'],
  bilal: ['bilal@nawazschool.edu', 'teacher123'],
  admin: ['admin@nawazschool.edu', 'admin123'],
};

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
  if (!body.idToken) throw new Error(body.error?.message || `sign-in failed for ${email}`);
  return body.idToken;
}

async function getState(token) {
  const response = await fetch(`${API}/api/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.json();
}

async function patchRemark(token, studentId, text) {
  const response = await fetch(`${API}/api/students/${studentId}/remark`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

const results = [];

try {
  start(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: '4104',
      DATA_BACKEND: 'json',
      DATA_DIR: dataDir,
      RUNTIME: '',
    },
  });
  await waitFor(`${API}/api/health`);

  const token = await signIn(...ACCOUNTS.teacher);
  const state = await getState(token);
  const teacher = state.staff.find((member) => member.email === 'teacher@nawazschool.edu');
  const classIds = state.permissions.teacherClassIds;
  const student = state.students.find((entry) => classIds.includes(entry.classIdSection));
  if (!student) throw new Error('No student in the teacher classes.');

  const text = 'Ayesha has improved steadily this term. Please keep 20 minutes for reading at home.';
  const saved = await patchRemark(token, student.id, text);
  results.push(['teacher can save a remark', saved.status === 200]);
  results.push(['the server returns the saved text', saved.body.remark?.text === text]);

  const after = await getState(token);
  const stored = after.students.find((entry) => entry.id === student.id)?.reportRemarks?.[teacher.id];
  results.push(['the remark persists on the student record', stored?.text === text]);
  results.push(['the author is recorded', stored?.updatedBy === teacher.id]);

  const tooLong = await patchRemark(token, student.id, 'x'.repeat(601));
  results.push(['remarks over 600 characters are rejected', tooLong.status === 400]);

  let outsider = null;
  for (const [name, [email, password]] of Object.entries(ACCOUNTS)) {
    if (name === 'teacher' || name === 'admin') continue;
    const other = await signIn(email, password);
    const otherState = await getState(other);
    if (!otherState.permissions.teacherClassIds.includes(student.classIdSection)) {
      outsider = { token: other, name };
      break;
    }
  }
  if (outsider) {
    const denied = await patchRemark(outsider.token, student.id, 'Not my class.');
    results.push([`a teacher outside ${student.classIdSection} is rejected`, denied.status === 403]);
  } else {
    results.push(['a teacher outside the class is rejected', false]);
  }

  const cleared = await patchRemark(token, student.id, '');
  results.push(['a teacher can reset to the suggested remark', cleared.status === 200]);

  const adminToken = await signIn(...ACCOUNTS.admin);
  const adminState = await getState(adminToken);
  const admin = adminState.staff.find((member) => member.email === 'admin@nawazschool.edu');
  const adminSaved = await patchRemark(adminToken, student.id, 'Administrator note for the guardian.');
  results.push(['an administrator can also write a remark', adminSaved.status === 200]);

  const finalState = await getState(token);
  const finalRecord = finalState.students.find((entry) => entry.id === student.id);
  results.push([
    'clearing removes only the teacher’s custom remark',
    !finalRecord?.reportRemarks?.[teacher.id],
  ]);
  results.push([
    'another author’s remark is preserved',
    finalRecord?.reportRemarks?.[admin.id]?.text === 'Administrator note for the guardian.',
  ]);
  results.push(['the revision advanced', finalState.meta.revision > state.meta.revision]);
  results.push(['no student fields were lost', finalRecord?.name === student.name && finalRecord?.classIdSection === student.classIdSection]);
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
