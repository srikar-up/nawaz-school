/**
 * Marks search / filter / sort checks on the running dev servers.
 *
 *   node server/test/marks-filters.e2e.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'http://localhost:4000';
const TEACHER_URL = 'http://localhost:5173';
const ADMIN_URL = 'http://localhost:5174';
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

async function readState(token) {
  const response = await fetch(`${API}/api/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`state failed (${response.status})`);
  return response.json();
}

async function login(page, baseUrl, email, password, key) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction((sessionKey) => Boolean(localStorage.getItem(sessionKey)), key, {
    timeout: 45000,
  });
}

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});
const results = [];

try {
  const teacherToken = await signIn('teacher@nawazschool.edu', 'teacher123');
  const state = await readState(teacherToken);
  const teacher = state.staff.find((member) => member.email === 'teacher@nawazschool.edu');
  const now = new Date();
  const openExam = state.exams.find(
    (exam) =>
      exam.assignedStaffId === teacher.id &&
      exam.marksStatus !== 'Submitted' &&
      new Date(`${exam.date}T${exam.endTime || '23:59'}:00`) < now
  );
  if (!openExam) throw new Error('No open exam found for the demo teacher.');

  const teacherRoster = state.students
    .filter((student) => student.classIdSection === openExam.classIdSection)
    .sort((a, b) => Number(a.rollNumber) - Number(b.rollNumber));
  const teacherRecords = state.testRecords.filter((record) => record.examId === openExam.id);
  const teacherMissing = teacherRoster.length - teacherRecords.length;
  const firstStudent = teacherRoster[0];
  const lastName = [...teacherRoster].sort((a, b) => b.name.localeCompare(a.name))[0];

  const teacherPage = await browser.newPage();
  const teacherErrors = [];
  teacherPage.on('pageerror', (error) => teacherErrors.push(error.message));
  teacherPage.on('console', (message) => message.type() === 'error' && teacherErrors.push(message.text()));

  await login(teacherPage, TEACHER_URL, 'teacher@nawazschool.edu', 'teacher123', 'nawaz.teacher.session.v1');
  await teacherPage.goto(`${TEACHER_URL}/tasks/exams/${openExam.id}`, { waitUntil: 'domcontentloaded' });
  await teacherPage.waitForSelector('.marks-filter-bar', { timeout: 40000 });

  const teacherRows = teacherPage.locator('.marks-list .mark-row');
  results.push(['teacher marks toolbar is visible', (await teacherPage.locator('.marks-filter-bar').count()) === 1]);
  results.push(['teacher sees the full roster first', (await teacherRows.count()) === teacherRoster.length]);

  const search = teacherPage.getByLabel('Search students by name or roll');
  await search.fill(firstStudent.name);
  await teacherPage.waitForTimeout(400);
  results.push(['search narrows the teacher list', (await teacherRows.count()) === 1]);

  await search.fill('');
  await teacherPage.getByLabel('Filter students by score status').selectOption('missing');
  await teacherPage.waitForTimeout(400);
  results.push(['missing-score filter counts correctly', (await teacherRows.count()) === teacherMissing]);

  await teacherPage.getByLabel('Filter students by score status').selectOption('all');
  await teacherPage.getByLabel('Sort students').selectOption('name');
  await teacherPage.getByRole('button', { name: /sort descending/i }).click();
  await teacherPage.waitForTimeout(400);
  const teacherFirst = await teacherPage.locator('.mark-student strong').first().innerText();
  results.push(['teacher name sort works both ways', teacherFirst.trim() === lastName.name]);

  await search.fill('zzzz-no-such-student');
  await teacherPage.waitForTimeout(400);
  results.push(['teacher empty state appears for no matches', (await teacherPage.locator('.marks-empty').count()) === 1]);
  results.push(['no teacher page errors', teacherErrors.length === 0]);
  await teacherPage.close();

  // ---------- admin result matrix ----------
  const submitted = state.exams.find((exam) => exam.marksStatus === 'Submitted');
  if (!submitted) throw new Error('No submitted exam found.');
  const adminRoster = state.students
    .filter((student) => student.classIdSection === submitted.classIdSection)
    .sort((a, b) => Number(a.rollNumber) - Number(b.rollNumber));
  const adminRecords = state.testRecords.filter((record) => record.examId === submitted.id);

  const adminPage = await browser.newPage();
  const adminErrors = [];
  adminPage.on('pageerror', (error) => adminErrors.push(error.message));
  adminPage.on('console', (message) => message.type() === 'error' && adminErrors.push(message.text()));

  await login(adminPage, ADMIN_URL, 'admin@nawazschool.edu', 'admin123', 'nawaz.admin.session.v1');
  await adminPage.goto(`${ADMIN_URL}/exams`, { waitUntil: 'domcontentloaded' });
  await adminPage.getByRole('button', { name: /result matrix/i }).click();
  await adminPage.waitForSelector('.result-filter-bar', { timeout: 40000 });

  const adminRows = adminPage.locator('.result-table-card tbody tr');
  const adminRowCount = async () =>
    (await adminRows.count()) - (await adminPage.locator('.table-empty-note').count());
  results.push(['admin result toolbar is visible', (await adminPage.locator('.result-filter-bar').count()) === 1]);
  results.push(['admin sees the full result roster', (await adminRowCount()) === adminRoster.length]);

  const adminSearch = adminPage.getByLabel('Search the result matrix');
  await adminSearch.fill(adminRoster[0].name);
  await adminPage.waitForTimeout(400);
  results.push(['admin search narrows the result matrix', (await adminRowCount()) === 1]);

  await adminSearch.fill('');
  await adminPage.getByLabel('Filter results by status').selectOption('missing');
  await adminPage.waitForTimeout(400);
  results.push([
    'admin not-entered filter counts correctly',
    (await adminRowCount()) === adminRoster.length - adminRecords.length,
  ]);

  await adminPage.getByLabel('Filter results by status').selectOption('entered');
  results.push([
    'admin entered filter counts correctly',
    (await adminRowCount()) === adminRecords.length,
  ]);

  await adminPage.getByLabel('Filter results by status').selectOption('all');
  await adminPage.getByLabel('Sort the result matrix').selectOption('percentage');
  await adminPage.waitForTimeout(400);
  const percentages = await adminPage
    .locator('.result-table-card tbody tr td:nth-child(4)')
    .allInnerTexts();
  const numbers = percentages.map((text) => Number(String(text).replace('%', ''))).filter(Number.isFinite);
  const ascending = numbers.every((value, index) => index === 0 || numbers[index - 1] <= value);
  results.push(['admin percentage sort is ascending', ascending && numbers.length > 1]);

  await adminSearch.fill('zzzz-no-such-student');
  await adminPage.waitForTimeout(400);
  results.push(['admin empty state appears for no matches', (await adminPage.locator('.table-empty-note').count()) === 1]);
  results.push(['no admin page errors', adminErrors.length === 0]);
  await adminPage.close();
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
