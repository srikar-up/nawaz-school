/**
 * Teacher can edit the progress-report remark in the browser.
 *
 *   node server/test/report-remark-ui.e2e.mjs
 *
 * Needs the dev API (:4000) and teacher Vite server (:5173) running.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = 'http://localhost:4000';
const TEACHER_URL = 'http://localhost:5173';
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
const state = await (
  await fetch(`${API}/api/state`, { headers: { Authorization: `Bearer ${token}` } })
).json();
const teacher = state.staff.find((member) => member.email === 'teacher@nawazschool.edu');
const student = state.students.find((entry) =>
  state.permissions.teacherClassIds.includes(entry.classIdSection)
);
if (!student) throw new Error('No student in the teacher classes.');

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});
const results = [];
const remark = `Custom remark ${Date.now()}: needs regular revision at home.`;

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
    () => Boolean(localStorage.getItem('nawaz.teacher.session.v1')),
    null,
    { timeout: 45000 }
  );

  await page.goto(`${TEACHER_URL}/reports?student=${student.id}`, {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForSelector('.teacher-remark', { timeout: 40000 });
  results.push([
    'the report shows the suggested remark',
    (await page.getByText('suggested', { exact: false }).count()) > 0,
  ]);

  await page.getByRole('button', { name: /edit remark/i }).click();
  const textarea = page.getByLabel('Teacher remark');
  await textarea.waitFor({ timeout: 15000 });
  await textarea.fill(remark);
  await page.getByRole('button', { name: /save remark/i }).click();
  await page.waitForTimeout(1800);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.teacher-remark', { timeout: 40000 });
  await page.waitForFunction((text) => document.body.innerText.includes(text), remark, {
    timeout: 30000,
  });
  results.push([
    'the saved remark survives a reload',
    (await page.getByText(remark, { exact: false }).count()) > 0,
  ]);
  results.push([
    'the report labels the saved remark as the teacher’s',
    (await page.getByText('your saved remark', { exact: false }).count()) > 0,
  ]);

  await page.getByRole('button', { name: /edit remark/i }).click();
  await page.getByRole('button', { name: /use suggested/i }).click();
  await page.waitForTimeout(1800);
  results.push([
    'the teacher can return to the suggested remark',
    (await page.getByText(remark, { exact: false }).count()) === 0,
  ]);
  results.push(['no teacher page errors', errors.length === 0]);
  if (errors.length) console.log('page errors:', errors.slice(0, 4));
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
