/**
 * Full teacher flow for the full-day attendance mode.
 *
 * Spawns an isolated API (:4100, temporary JSON database) and a second teacher
 * dev server (:5175) pointed at it, so the real Firestore data is untouched.
 * Logs in, submits a full-day register through the UI, and verifies the saved
 * session through the API.
 *
 *   node server/test/attendance-flow.e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const TEACHER_DIR = path.join(ROOT, 'teacher-app');
const API = 'http://127.0.0.1:4100';
const UI = 'http://127.0.0.1:5175';
const API_KEY = fs
  .readFileSync(path.join(SERVER_DIR, '.env'), 'utf8')
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

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-attendance-flow-'));
const children = [];

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
  child.stdout.on('data', (chunk) => {
    if (process.env.DEBUG_CHILD) process.stdout.write(chunk);
  });
  child.stderr.on('data', (chunk) => {
    if (process.env.DEBUG_CHILD) process.stderr.write(chunk);
  });
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

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});

const results = [];

try {
  start(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      PORT: '4100',
      DATA_BACKEND: 'json',
      DATA_DIR: dataDir,
      CORS_ORIGINS: UI,
      RUNTIME: '',
    },
  });

  start(
    process.execPath,
    [
      path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'),
      '--port',
      '5175',
      '--strictPort',
      // Vite binds `localhost` by default, which does not answer on 127.0.0.1
      // on every platform. The API allowlist and the browser both use the
      // explicit loopback address below.
      '--host',
      '127.0.0.1',
    ],
    {
      cwd: TEACHER_DIR,
      env: { ...process.env, VITE_API_URL: API },
    }
  );

  await waitFor(`${API}/api/health`);
  await waitFor(UI);

  const adminToken = await signIn('admin@nawazschool.edu', 'admin123');
  await setMode(adminToken, 'fullDay');

  const stateBefore = await (
    await fetch(`${API}/api/state`, { headers: { Authorization: `Bearer ${adminToken}` } })
  ).json();
  const morningCountBefore = stateBefore.attendanceSessions.filter(
    (session) => session.sessionType === 'Morning'
  ).length;

  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (message) => message.type() === 'error' && consoleErrors.push(message.text()));
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  await page.goto(UI, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', 'teacher@nawazschool.edu');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => Boolean(window.localStorage.getItem('nawaz.teacher.session.v1')),
    null,
    { timeout: 45000 }
  );

  await page.goto(`${UI}/attendance`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[aria-label="Session"] button', { timeout: 40000 });

  const labels = (await page.locator('[aria-label="Session"] button').allInnerTexts()).map((label) =>
    label.trim()
  );
  results.push(['teacher sees a single Full day register', JSON.stringify(labels) === JSON.stringify(['Full day'])]);
  results.push(['teacher sees no split sessions', !labels.includes('Morning') && !labels.includes('Afternoon')]);

  const submit = page.getByRole('button', { name: /submit attendance/i });
  results.push(['submit is enabled', await submit.isEnabled()]);

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/attendance') && response.request().method() === 'POST',
    { timeout: 30000 }
  );
  await submit.click();
  const response = await responsePromise;
  results.push(['UI submits the full-day register', response.status() === 200]);

  const body = await response.json().catch(() => ({}));
  results.push(['saved session is FullDay', body?.attendance?.sessionType === 'FullDay']);
  results.push(['saved session has the roster', (body?.attendance?.entries?.length || 0) > 0]);

  const state = await (
    await fetch(`${API}/api/state`, { headers: { Authorization: `Bearer ${adminToken}` } })
  ).json();
  const saved = state.attendanceSessions.find(
    (session) => session.sessionType === 'FullDay' && session.id === body?.attendance?.id
  );
  results.push(['session is persisted in the database', Boolean(saved)]);
  results.push([
    'no morning register was added',
    state.attendanceSessions.filter((session) => session.sessionType === 'Morning').length ===
      morningCountBefore,
  ]);
  results.push(['no page errors', consoleErrors.length === 0]);

  // Switching the school back must be reflected without a reload.
  await setMode(adminToken, 'twoSessions');
  await page
    .waitForFunction(
      () => {
        const buttons = [...document.querySelectorAll('[aria-label="Session"] button')].map((node) =>
          node.textContent.trim()
        );
        return buttons.length === 2 && buttons.includes('Morning') && buttons.includes('Afternoon');
      },
      null,
      { timeout: 20000 }
    )
    .catch(() => {});
  const afterLabels = (await page.locator('[aria-label="Session"] button').allInnerTexts()).map((label) =>
    label.trim()
  );
  results.push([
    'teacher updates to Morning and Afternoon live',
    JSON.stringify(afterLabels) === JSON.stringify(['Morning', 'Afternoon']),
  ]);

  await page.close();
} finally {
  await browser.close();
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
