/**
 * Attendance-mode UI test.
 *
 * Requires the dev servers (API :4000, teacher :5173, admin :5174). Toggles the
 * school mode through the API, checks both UIs, and always restores the
 * original value:
 *
 *   node server/test/attendance-ui.e2e.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
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
  return response.json();
}

async function readMode(token) {
  const response = await fetch(`${API}/api/state`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const state = await response.json();
  return state.meta.attendanceMode || 'twoSessions';
}

async function login(page, baseUrl, email, password, sessionKey) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    (key) => Boolean(window.localStorage.getItem(key)),
    sessionKey,
    { timeout: 45000 }
  );
}

const sessionLabels = (page) =>
  page.locator('[aria-label="Session"] button').allInnerTexts();

const results = [];
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});

let originalMode = 'twoSessions';

try {
  const adminToken = await signIn('admin@nawazschool.edu', 'admin123');
  originalMode = await readMode(adminToken);
  console.log('original mode:', originalMode);

  // ---------- full-day mode ----------
  await setMode(adminToken, 'fullDay');

  const teacherPage = await browser.newPage();
  teacherPage.on('pageerror', (error) => console.log('teacher pageerror:', error.message));
  await login(teacherPage, TEACHER_URL, 'teacher@nawazschool.edu', 'teacher123', 'nawaz.teacher.session.v1');
  await teacherPage.goto(`${TEACHER_URL}/attendance`, { waitUntil: 'domcontentloaded' });
  await teacherPage.waitForSelector('[aria-label="Session"] button', { timeout: 40000 });

  const fullDayLabels = (await sessionLabels(teacherPage)).map((label) => label.trim());
  results.push(['teacher shows only Full day', JSON.stringify(fullDayLabels) === JSON.stringify(['Full day'])]);

  const note = await teacherPage.locator('.attendance-mode-note').innerText().catch(() => '');
  results.push(['teacher explains the single register', /whole day/i.test(note)]);

  // ---------- two-session mode ----------
  await setMode(adminToken, 'twoSessions');

  await teacherPage
    .waitForFunction(
      () => {
        const labels = [...document.querySelectorAll('[aria-label="Session"] button')].map((node) =>
          node.textContent.trim()
        );
        return labels.length === 2 && labels.includes('Morning') && labels.includes('Afternoon');
      },
      null,
      { timeout: 20000 }
    )
    .catch(() => {});

  let twoSessionLabels = (await sessionLabels(teacherPage)).map((label) => label.trim());
  if (twoSessionLabels.length !== 2) {
    await teacherPage.reload({ waitUntil: 'domcontentloaded' });
    await teacherPage.waitForSelector('[aria-label="Session"] button', { timeout: 40000 });
    twoSessionLabels = (await sessionLabels(teacherPage)).map((label) => label.trim());
  }
  results.push([
    'teacher shows Morning and Afternoon',
    JSON.stringify(twoSessionLabels) === JSON.stringify(['Morning', 'Afternoon']),
  ]);
  results.push([
    'teacher no longer offers Full day',
    !twoSessionLabels.includes('Full day'),
  ]);
  results.push([
    'mode note disappears in two-session mode',
    (await teacherPage.locator('.attendance-mode-note').count()) === 0,
  ]);
  await teacherPage.close();

  // ---------- admin UI ----------
  const adminPage = await browser.newPage();
  adminPage.on('pageerror', (error) => console.log('admin pageerror:', error.message));
  await login(adminPage, ADMIN_URL, 'admin@nawazschool.edu', 'admin123', 'nawaz.admin.session.v1');

  await adminPage.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('input[name="attendanceMode"]', { timeout: 40000 });
  const radios = await adminPage.locator('input[name="attendanceMode"]').count();
  const saveMode = await adminPage.getByRole('button', { name: /save attendance mode/i }).count();
  results.push(['admin settings exposes both modes', radios === 2]);
  results.push(['admin settings has a save action', saveMode === 1]);
  results.push([
    'admin settings shows the full-day option',
    (await adminPage.getByText('One full-day register').count()) > 0,
  ]);

  await adminPage.goto(`${ADMIN_URL}/attendance`, { waitUntil: 'domcontentloaded' });
  await adminPage
    .waitForFunction(
      () => {
        const labels = [...document.querySelectorAll('.admin-session-switch button')].map((node) =>
          node.textContent.trim()
        );
        return labels.length === 2 && labels.includes('Morning') && labels.includes('Afternoon');
      },
      null,
      { timeout: 30000 }
    )
    .catch(() => {});
  const adminSessionLabels = (
    await adminPage.locator('.admin-session-switch button').allInnerTexts()
  ).map((label) => label.trim());
  results.push([
    'admin attendance offers Morning and Afternoon',
    JSON.stringify(adminSessionLabels) === JSON.stringify(['Morning', 'Afternoon']),
  ]);
  results.push([
    'admin attendance explains the split',
    /tracked separately/i.test(await adminPage.locator('.attendance-session-hint').innerText()),
  ]);

  // ---------- admin full-day view ----------
  await setMode(adminToken, 'fullDay');
  await adminPage.reload({ waitUntil: 'domcontentloaded' });
  await adminPage
    .waitForFunction(
      () => {
        const labels = [...document.querySelectorAll('.admin-session-switch button')].map((node) =>
          node.textContent.trim()
        );
        return labels.length === 1 && labels[0] === 'Full day';
      },
      null,
      { timeout: 30000 }
    )
    .catch(() => {});
  const adminFullDayLabels = (
    await adminPage.locator('.admin-session-switch button').allInnerTexts()
  ).map((label) => label.trim());
  results.push([
    'admin attendance shows only Full day',
    JSON.stringify(adminFullDayLabels) === JSON.stringify(['Full day']),
  ]);
  results.push([
    'admin attendance explains the single register',
    /whole day/i.test(await adminPage.locator('.attendance-session-hint').innerText()),
  ]);

  // ---------- saving from the settings screen ----------
  await setMode(adminToken, 'twoSessions');
  await adminPage.goto(`${ADMIN_URL}/settings`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForSelector('input[name="attendanceMode"]', { timeout: 40000 });
  await adminPage
    .waitForFunction(
      () => document.querySelector('input[name="attendanceMode"][value="twoSessions"]')?.checked,
      null,
      { timeout: 30000 }
    )
    .catch(() => {});
  await adminPage.locator('input[name="attendanceMode"][value="fullDay"]').check();
  const saveButton = adminPage.getByRole('button', { name: /save attendance mode/i });
  await adminPage
    .waitForFunction(
      () => {
        const button = [...document.querySelectorAll('button')].find((node) =>
          /save attendance mode/i.test(node.textContent || '')
        );
        return Boolean(button && !button.disabled);
      },
      null,
      { timeout: 15000 }
    )
    .catch(() => {});
  await saveButton.click({ timeout: 15000 });
  await adminPage.waitForTimeout(3000);
  results.push(['admin can save the mode from settings', (await readMode(adminToken)) === 'fullDay']);

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
