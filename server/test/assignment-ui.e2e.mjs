/**
 * Teacher assignment form permissions.
 *
 * Opens the real teacher dev app and checks that the class and subject pickers
 * only offer classes and subjects assigned to the signed-in teacher. No write
 * is made; the API enforcement is covered by assignment-access.e2e.mjs.
 *
 *   node server/test/assignment-ui.e2e.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = process.env.API_URL || 'http://localhost:4000';
const TEACHER_URL = process.env.TEACHER_URL || 'http://localhost:5173';
const API_KEY = fs
  .readFileSync(path.join(ROOT, 'server', '.env'), 'utf8')
  .split(/\r?\n/)
  .find((line) => line.startsWith('FIREBASE_API_KEY='))
  ?.slice('FIREBASE_API_KEY='.length);

const CHROME = path.join(
  process.env.LOCALAPPDATA || '',
  'ms-playwright',
  'chromium-1254',
  'chrome-win',
  'chrome.exe'
);

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

const token = await signIn('teacher@nawazschool.edu', 'teacher123');
const stateResponse = await fetch(`${API}/api/state`, {
  headers: { Authorization: `Bearer ${token}` },
});
const state = await stateResponse.json();
const teacher = state.staff.find((member) => member.email === 'teacher@nawazschool.edu');
const mySubjects = state.subjects.filter((subject) => subject.assignedStaffId === teacher.id);
const teachableClassIds = [...new Set(mySubjects.map((subject) => subject.classIdSection))];
const classIdsForSubjects = (classId) =>
  mySubjects.filter((subject) => subject.classIdSection === classId).map((s) => s.subjectName);

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});
const results = [];

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

  await page.goto(TEACHER_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', 'teacher@nawazschool.edu');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => Boolean(window.localStorage.getItem('nawaz.teacher.session.v1')),
    null,
    { timeout: 45000 }
  );

  await page.goto(`${TEACHER_URL}/tasks?tab=assignments`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.tasks-toolbar', { timeout: 40000 });

  const newButton = page
    .locator('.tasks-toolbar')
    .getByRole('button', { name: /new assignment/i });
  results.push(['teacher has a New assignment action', (await newButton.count()) === 1]);
  await newButton.click();
  await page.waitForSelector('#assignment-form', { timeout: 15000 });

  const classSelect = page.locator('#assignment-form select').nth(0);
  const subjectSelect = page.locator('#assignment-form select').nth(1);

  const classValues = await classSelect.locator('option').evaluateAll((options) =>
    options.map((option) => option.value)
  );
  results.push([
    'class picker only lists classes the teacher works in',
    classValues.length === teachableClassIds.length &&
      classValues.every((id) => teachableClassIds.includes(id)),
  ]);

  const selectedClass = await classSelect.inputValue();
  const expectedSubjects = classIdsForSubjects(selectedClass);
  const subjectValues = await subjectSelect.locator('option').evaluateAll((options) =>
    options.map((option) => option.value).filter(Boolean)
  );
  results.push([
    'subject picker only lists subjects assigned to the teacher',
    subjectValues.length === expectedSubjects.length &&
      expectedSubjects.every((name) => subjectValues.includes(name)),
  ]);

  const foreignSubjects = state.subjects
    .filter(
      (subject) =>
        subject.classIdSection === selectedClass && subject.assignedStaffId !== teacher.id
    )
    .map((subject) => subject.subjectName);
  results.push([
    "another teacher's subjects are not offered",
    foreignSubjects.every((name) => !subjectValues.includes(name)),
  ]);

  if (classValues.length > 1) {
    const secondClass = classValues.find((id) => id !== selectedClass);
    await classSelect.selectOption(secondClass);
    await page.waitForTimeout(400);
    const updatedSubjects = await subjectSelect.locator('option').evaluateAll((options) =>
      options.map((option) => option.value).filter(Boolean)
    );
    const expected = classIdsForSubjects(secondClass);
    results.push([
      'changing class refreshes the allowed subjects',
      updatedSubjects.length === expected.length &&
        expected.every((name) => updatedSubjects.includes(name)),
    ]);
  } else {
    results.push(['changing class refreshes the allowed subjects', true]);
  }

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  results.push(['no page errors', errors.length === 0]);
  if (errors.length) console.log('page errors:', errors.slice(0, 3));
  await page.close();
} finally {
  await browser.close();
}

let pass = true;
for (const [label, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) pass = false;
}
console.log(`RESULT: ${JSON.stringify({ pass, checks: results.length })}`);
process.exit(pass ? 0 : 1);
