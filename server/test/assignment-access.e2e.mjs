/**
 * Assignment permissions against an isolated API.
 *
 *   node server/test/assignment-access.e2e.mjs
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

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-assignment-access-'));

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

if (process.env.DEBUG_CHILD) {
  child.stdout.on('data', (chunk) => process.stdout.write(`[api] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[api] ${chunk}`));
}

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
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, body: payload };
}

const results = [];
let teacherId = '';
let assignmentId = '';
let adminAssignmentId = '';

try {
  await waitForApi();
  const teacherToken = await signIn('teacher@nawazschool.edu', 'teacher123');
  const adminToken = await signIn('admin@nawazschool.edu', 'admin123');

  const state = (await call('/api/state', { token: adminToken })).body;
  const teacher = state.staff.find((member) => member.email === 'teacher@nawazschool.edu');
  teacherId = teacher.id;

  const ownSubject = state.subjects.find(
    (subject) => subject.classIdSection === '10-A' && subject.assignedStaffId === teacherId
  );
  const otherSubject = state.subjects.find(
    (subject) => subject.classIdSection === '10-A' && subject.assignedStaffId !== teacherId
  );
  const foreignClassSubject = state.subjects.find(
    (subject) => subject.classIdSection === '9-B' && subject.assignedStaffId !== teacherId
  );

  results.push(['test data has an own and a foreign subject', Boolean(ownSubject && otherSubject)]);

  const base = {
    title: 'Permission probe',
    classIdSection: ownSubject.classIdSection,
    description: 'Checks that teachers can only set work for their own subject.',
    dueDate: state.meta.today,
  };

  const own = await call('/api/assignments', {
    method: 'POST',
    token: teacherToken,
    body: { ...base, subject: ownSubject.subjectName },
  });
  results.push(['teacher can create for their own subject', own.status === 201]);
  assignmentId = own.body.assignment?.id || '';

  const foreign = await call('/api/assignments', {
    method: 'POST',
    token: teacherToken,
    body: { ...base, subject: otherSubject.subjectName },
  });
  results.push([
    'teacher cannot create for another teacher\'s subject',
    foreign.status === 403 && /assigned to you/i.test(foreign.body?.error || ''),
  ]);

  const foreignClass = await call('/api/assignments', {
    method: 'POST',
    token: teacherToken,
    body: {
      ...base,
      classIdSection: foreignClassSubject.classIdSection,
      subject: foreignClassSubject.subjectName,
    },
  });
  results.push([
    'teacher cannot create for a class they do not teach',
    foreignClass.status === 403,
  ]);

  const missingSubject = await call('/api/assignments', {
    method: 'POST',
    token: teacherToken,
    body: { ...base, subject: '' },
  });
  results.push(['a subject is required', missingSubject.status === 400]);

  const inventedSubject = await call('/api/assignments', {
    method: 'POST',
    token: teacherToken,
    body: { ...base, subject: 'Underwater Basket Weaving' },
  });
  results.push([
    'an unknown subject is rejected',
    inventedSubject.status === 400 && /not taught/i.test(inventedSubject.body?.error || ''),
  ]);

  const moveSubject = await call(`/api/assignments/${assignmentId}`, {
    method: 'PATCH',
    token: teacherToken,
    body: { subject: otherSubject.subjectName },
  });
  results.push([
    'teacher cannot move their assignment to another subject',
    moveSubject.status === 403,
  ]);

  const rename = await call(`/api/assignments/${assignmentId}`, {
    method: 'PATCH',
    token: teacherToken,
    body: { title: 'Permission probe updated' },
  });
  results.push(['teacher can still edit their own assignment', rename.status === 200]);

  const adminCreate = await call('/api/assignments', {
    method: 'POST',
    token: adminToken,
    body: { ...base, title: 'Admin assignment probe', subject: otherSubject.subjectName },
  });
  results.push(['admin can create for any subject', adminCreate.status === 201]);
  adminAssignmentId = adminCreate.body.assignment?.id || '';

  const adminMove = await call(`/api/assignments/${assignmentId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { subject: otherSubject.subjectName },
  });
  results.push(['admin can move an assignment between subjects', adminMove.status === 200]);

  const adminUnknown = await call('/api/assignments', {
    method: 'POST',
    token: adminToken,
    body: { ...base, title: 'Bad admin probe', subject: 'Underwater Basket Weaving' },
  });
  results.push(['admin still cannot use an unknown subject', adminUnknown.status === 400]);

  const after = (await call('/api/state', { token: adminToken })).body;
  results.push([
    'only accepted assignments were written',
    after.assignments.filter((entry) => entry.title.includes('Permission probe')).length === 1 &&
      after.assignments.filter((entry) => entry.title === 'Admin assignment probe').length === 1,
  ]);

  await call(`/api/assignments/${assignmentId}`, { method: 'DELETE', token: adminToken });
  await call(`/api/assignments/${adminAssignmentId}`, { method: 'DELETE', token: adminToken });
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
