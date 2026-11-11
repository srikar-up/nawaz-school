/**
 * Design-polish checks from target.md.
 *
 * Requires the dev servers (API :4000, teacher :5173, admin :5174).
 * Always restores the attendance mode it changed:
 *
 *   node server/test/polish-ui.e2e.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const API = process.env.API_URL || 'http://localhost:4000';
const TEACHER_URL = process.env.TEACHER_URL || 'http://localhost:5173';
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:5174';
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

async function setMode(token, attendanceMode) {
  const response = await fetch(`${API}/api/meta`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendanceMode }),
  });
  if (!response.ok) throw new Error(`mode change failed (${response.status})`);
}

async function readState(token) {
  const response = await fetch(`${API}/api/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`state failed (${response.status})`);
  return response.json();
}

async function login(page, baseUrl, email, password, sessionKey) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction((key) => Boolean(window.localStorage.getItem(key)), sessionKey, {
    timeout: 45000,
  });
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}

function shiftDay(iso, delta) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

const results = [];
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});

let originalMode = 'twoSessions';

try {
  const adminToken = await signIn('admin@nawazschool.edu', 'admin123');
  originalMode = (await readState(adminToken)).meta.attendanceMode || 'twoSessions';
  await setMode(adminToken, 'twoSessions');

  // ---------- teacher: unsaved attendance guard ----------
  const teacherPage = await browser.newPage();
  const teacherErrors = [];
  teacherPage.on('pageerror', (error) => teacherErrors.push(error.message));
  await login(
    teacherPage,
    TEACHER_URL,
    'teacher@nawazschool.edu',
    'teacher123',
    'nawaz.teacher.session.v1'
  );
  await teacherPage.goto(`${TEACHER_URL}/attendance`, { waitUntil: 'domcontentloaded' });
  await teacherPage.waitForSelector('.attendance-switch button', { timeout: 40000 });

  await teacherPage.locator('.attendance-switch button.absent').first().click();
  await teacherPage.getByRole('button', { name: /skip reason/i }).click();
  await teacherPage.waitForTimeout(300);

  const today = todayISO();
  const yesterday = shiftDay(today, -1);
  const dateInput = teacherPage.locator('input[type="date"]');

  let dismissMessage = '';
  teacherPage.once('dialog', async (dialog) => {
    dismissMessage = dialog.message();
    await dialog.dismiss();
  });
  await dateInput.fill(yesterday);
  await teacherPage.waitForTimeout(600);
  results.push([
    'teacher warns before discarding unsaved attendance',
    /unsaved attendance/i.test(dismissMessage),
  ]);
  results.push(['dismissing the warning keeps the date', (await dateInput.inputValue()) === today]);
  results.push([
    'dismissing the warning keeps the edited status',
    (await teacherPage.locator('.attendance-switch button.absent.active').count()) === 1,
  ]);

  teacherPage.once('dialog', (dialog) => dialog.accept());
  await dateInput.fill(yesterday);
  await teacherPage.waitForTimeout(600);
  results.push(['accepting the warning changes the date', (await dateInput.inputValue()) === yesterday]);
  results.push(['no teacher page errors', teacherErrors.length === 0]);
  await teacherPage.close();

  // ---------- admin: help dialog ----------
  const adminPage = await browser.newPage();
  const adminErrors = [];
  adminPage.on('pageerror', (error) => adminErrors.push(error.message));
  await login(adminPage, ADMIN_URL, 'admin@nawazschool.edu', 'admin123', 'nawaz.admin.session.v1');

  await adminPage.getByRole('button', { name: /open help and quick guides/i }).click();
  await adminPage.waitForSelector('.help-item', { timeout: 15000 });
  results.push([
    'admin help dialog opens',
    /help and quick guides/i.test(await adminPage.locator('.modal-card h2').innerText()),
  ]);
  results.push(['help lists four quick guides', (await adminPage.locator('.help-item').count()) === 4]);
  results.push([
    'help offers the school contact',
    (await adminPage.locator('.help-contact-links a').count()) >= 1,
  ]);
  await adminPage.getByRole('button', { name: /close dialog/i }).click();
  await adminPage.waitForSelector('.help-item', { state: 'detached', timeout: 10000 }).catch(() => {});
  results.push(['help dialog closes', (await adminPage.locator('.help-item').count()) === 0]);

  // ---------- admin: full-day mode is understood everywhere ----------
  await setMode(adminToken, 'fullDay');
  const state = await readState(adminToken);
  const todayIso = todayISO();
  const waiting = state.classes.filter(
    (cls) =>
      !state.attendanceSessions.some(
        (session) =>
          session.classIdSection === cls.id &&
          session.date === todayIso &&
          session.sessionType === 'FullDay'
      )
  ).length;

  await adminPage.goto(`${ADMIN_URL}/overview`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('[aria-label="Notifications"]', { timeout: 40000 });
  await adminPage
    .waitForFunction(
      (expected) => {
        const chip = document.querySelector('.sync-chip');
        return Boolean(chip && /up to date/i.test(chip.textContent || ''));
      },
      null,
      { timeout: 20000 }
    )
    .catch(() => {});
  await adminPage.getByRole('button', { name: /notifications/i }).click();
  await adminPage.waitForSelector('.topbar-popover', { timeout: 15000 });
  await adminPage
    .waitForFunction(
      (expected) => {
        const popover = document.querySelector('.topbar-popover');
        return Boolean(popover && popover.textContent.includes(`${expected} class`));
      },
      waiting,
      { timeout: 20000 }
    )
    .catch(() => {});
  const bellText = await adminPage.locator('.topbar-popover').innerText();
  const chipText = await adminPage.locator('.sync-chip').innerText();
  results.push([
    'full-day mode drives the waiting-class notification',
    bellText.includes(`${waiting} class`) && /without attendance/i.test(bellText),
  ]);
  results.push(['sync chip uses plain language', /up to date/i.test(chipText)]);
  if (!bellText.includes(`${waiting} class`) || !/without attendance/i.test(bellText)) {
    console.log(`DEBUG bell (expected ${waiting}):`, JSON.stringify(bellText));
  }
  if (!/up to date/i.test(chipText)) console.log('DEBUG chip:', JSON.stringify(chipText));
  results.push(['no admin page errors', adminErrors.length === 0]);
  await adminPage.close();
} finally {
  const adminToken = await signIn('admin@nawazschool.edu', 'admin123').catch(() => null);
  if (adminToken) await setMode(adminToken, originalMode).catch(() => {});
  await browser.close();
}

let pass = true;
for (const [label, ok] of results) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) pass = false;
}
console.log(`RESULT: ${JSON.stringify({ pass, checks: results.length })}`);
process.exit(pass ? 0 : 1);
