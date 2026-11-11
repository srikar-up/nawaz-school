/**
 * Curriculum API flow against an isolated instance.
 *
 * Spawns its own API on :4100 with a temporary JSON database:
 *
 *   node server/test/curriculum.e2e.mjs
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

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-curriculum-'));

const child = spawn(process.execPath, ['src/index.js'], {
  cwd: SERVER_DIR,
  env: {
    ...process.env,
    PORT,
    DATA_BACKEND: 'json',
    DATA_DIR: dataDir,
    CORS_ORIGINS: 'http://localhost:5174',
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

let token = '';

async function call(pathname, { method = 'GET', body } = {}) {
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

const state = async () => (await call('/api/state')).body;
const results = [];

try {
  await waitForApi();
  token = await signIn('admin@nawazschool.edu', 'admin123');

  const initial = await state();
  results.push(['seed creates shared grade curricula', initial.curricula.length >= 2]);
  results.push(['curricula flag is recorded', initial.meta.curriculaSeeded === true]);

  const grade10Subjects = new Set(
    initial.subjects
      .filter((subject) => subject.classIdSection.startsWith('10-'))
      .map((subject) => subject.subjectName)
  );
  const mathCurriculum = initial.curricula.find(
    (entry) => entry.gradeLevel === 10 && entry.subjectName === 'Mathematics'
  );
  results.push([
    'grade 10 curricula mirror the seeded subjects',
    Boolean(mathCurriculum) && grade10Subjects.has(mathCurriculum.subjectName),
  ]);

  // ---------- create and share with the whole grade ----------
  const created = await call('/api/curricula', {
    method: 'POST',
    body: {
      gradeLevel: 10,
      subjectName: 'Environmental Science',
      subjectCode: 'ENVS-10',
      isLab: true,
      chapters: [{ title: 'Ecosystems' }, { title: 'Water' }, { title: 'Climate' }],
      sections: ['10-A', '10-B'],
    },
  });
  results.push(['admin can create a grade subject', created.status === 201]);
  results.push(['create applies to both sections', created.body.created === 2]);

  let afterCreate = await state();
  const createdCurriculum = afterCreate.curricula.find(
    (entry) => entry.subjectName === 'Environmental Science'
  );
  const offerings = afterCreate.subjects.filter(
    (subject) => subject.curriculumId === createdCurriculum.id
  );
  results.push([
    'every grade 10 section gets an offering',
    offerings.length === 2 &&
      ['10-A', '10-B'].every((section) =>
        offerings.some((offering) => offering.classIdSection === section)
      ),
  ]);
  results.push([
    'shared chapters are copied to each section',
    offerings.every(
      (offering) =>
        offering.chapters.length === 3 && offering.chapters[0].title === 'Ecosystems'
    ),
  ]);
  results.push([
    'new offerings start unassigned',
    offerings.every((offering) => offering.assignedStaffId === ''),
  ]);

  // ---------- progress follows the chapter title ----------
  const offering10A = offerings.find((offering) => offering.classIdSection === '10-A');
  const completed = await call(`/api/subjects/${offering10A.id}/chapters`, {
    method: 'POST',
    body: { chapterIndex: 0, status: 'completed' },
  });
  results.push(['a teacher can mark a chapter complete', completed.status === 200]);

  const edited = await call(`/api/curricula/${createdCurriculum.id}`, {
    method: 'PATCH',
    body: {
      chapters: [{ title: 'Water' }, { title: 'Ecosystems' }, { title: 'Energy' }],
    },
  });
  results.push(['admin can edit the shared chapter list', edited.status === 200]);

  const afterEdit = await state();
  const edited10A = afterEdit.subjects.find((subject) => subject.id === offering10A.id);
  const edited10B = afterEdit.subjects.find(
    (subject) => subject.curriculumId === createdCurriculum.id && subject.classIdSection === '10-B'
  );
  results.push([
    'chapter progress survives reordering and replacement',
    edited10A.chapters[1].title === 'Ecosystems' && edited10A.chapters[1].status === 'completed',
  ]);
  results.push([
    'new chapters start as not started',
    edited10A.chapters[2].title === 'Energy' && edited10A.chapters[2].status === 'pending',
  ]);
  results.push([
    'every section stays in sync',
    edited10B.chapters.length === 3 &&
      edited10B.chapters[0].title === 'Water' &&
      edited10B.chapters[2].title === 'Energy',
  ]);

  // ---------- rename is reflected everywhere ----------
  const renamed = await call(`/api/curricula/${createdCurriculum.id}`, {
    method: 'PATCH',
    body: { subjectName: 'Environmental Studies', subjectCode: 'ENVST-10' },
  });
  results.push(['admin can rename a grade subject', renamed.status === 200]);

  const afterRename = await state();
  const renamedOfferings = afterRename.subjects.filter(
    (subject) => subject.curriculumId === createdCurriculum.id
  );
  results.push([
    'rename updates every section offering',
    renamedOfferings.length === 2 &&
      renamedOfferings.every(
        (offering) =>
          offering.subjectName === 'Environmental Studies' &&
          offering.subjectCode === 'ENVST-10'
      ),
  ]);

  // An existing subject with timetable and exam rows keeps its display name.
  const timetableBefore = initial.timetable.find((period) => period.subjectId === 'sub-10-a-math-10');
  const mathRename = await call(`/api/curricula/${mathCurriculum.id}`, {
    method: 'PATCH',
    body: { subjectName: 'Mathematics II' },
  });
  const afterMath = await state();
  const timetableAfter = afterMath.timetable.find(
    (period) => period.id === timetableBefore?.id
  );
  const examAfter = afterMath.exams.find((exam) => exam.subjectId === 'sub-10-a-math-10');
  results.push([
    'rename updates timetable and exam labels',
    mathRename.status === 200 &&
      timetableAfter.subject === 'Mathematics II' &&
      examAfter.subject === 'Mathematics II',
  ]);

  // ---------- apply, validation and delete ----------
  const reapply = await call(`/api/curricula/${createdCurriculum.id}/apply`, {
    method: 'POST',
    body: { sections: ['10-A', '10-B'] },
  });
  results.push([
    're-applying reports updates, not duplicates',
    reapply.status === 200 && reapply.body.created === 0 && reapply.body.updated === 2,
  ]);

  const wrongSection = await call(`/api/curricula/${createdCurriculum.id}/apply`, {
    method: 'POST',
    body: { sections: ['9-A'] },
  });
  results.push(['another grade cannot be added', wrongSection.status === 400]);

  const duplicate = await call('/api/curricula', {
    method: 'POST',
    body: {
      gradeLevel: 10,
      subjectName: 'Environmental Studies',
      chapters: [{ title: 'One' }],
    },
  });
  results.push(['duplicate grade subjects are rejected', duplicate.status === 400]);

  const emptyChapters = await call('/api/curricula', {
    method: 'POST',
    body: { gradeLevel: 10, subjectName: 'Robotics', chapters: [] },
  });
  results.push(['empty chapter lists are rejected', emptyChapters.status === 400]);

  const badGrade = await call('/api/curricula', {
    method: 'POST',
    body: { gradeLevel: 20, subjectName: 'Robotics', chapters: [{ title: 'One' }] },
  });
  results.push(['invalid grades are rejected', badGrade.status === 400]);

  const beforeCount = (await state()).subjects.length;
  const removed = await call(`/api/curricula/${createdCurriculum.id}`, { method: 'DELETE' });
  const afterDelete = await state();
  results.push(['admin can remove a grade subject', removed.status === 200]);
  results.push([
    'removing the curriculum keeps class subjects',
    afterDelete.subjects.length === beforeCount &&
      afterDelete.subjects.some((subject) => subject.curriculumId === createdCurriculum.id) &&
      !afterDelete.curricula.some((entry) => entry.id === createdCurriculum.id),
  ]);
  results.push([
    'rejected requests wrote nothing',
    afterDelete.curricula.length === initial.curricula.length,
  ]);
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
