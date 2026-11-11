/**
 * CSV parsing + commit against an isolated API.
 *
 * Drives the real Data exchange screen: a CSV is parsed in the browser,
 * committed through /api/import, then the page is reloaded and the new row is
 * checked in the database.
 *
 *   node server/test/csv-import.e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { collectionToCsv } from '../../admin-panel/src/lib/dataExchange.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const ADMIN_DIR = path.join(ROOT, 'admin-panel');
const API = 'http://127.0.0.1:4100';
const UI = 'http://127.0.0.1:5176';
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

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-csv-import-'));
const children = [];

function start(command, args, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  if (process.env.DEBUG_CHILD) {
    child.stdout.on('data', (chunk) => process.stdout.write(chunk));
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  }
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

async function waitFor(url, attempts = 100) {
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

const token = { value: '' };

async function apiState() {
  const response = await fetch(`${API}/api/state`, {
    headers: { Authorization: `Bearer ${token.value}` },
  });
  return response.json();
}

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});

const results = [];
const PROBE_TITLE = 'CSV import probe';

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
      '5176',
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    { cwd: ADMIN_DIR, env: { ...process.env, VITE_API_URL: API } }
  );

  await waitFor(`${API}/api/health`);
  await waitFor(UI);
  token.value = await signIn('admin@nawazschool.edu', 'admin123');

  const state = await apiState();
  const probe = {
    id: 'ANN-TEST-IMPORT',
    title: PROBE_TITLE,
    body: 'This row was parsed from a CSV file and committed to the school database.',
    importance: 'Normal',
    audience: 'All',
    isPinned: false,
    publisherName: 'CSV import test',
    createdAt: new Date().toISOString(),
  };
  const csv = collectionToCsv(
    { ...state, announcements: [probe, ...state.announcements] },
    'announcements'
  );

  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

  await page.goto(UI, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', 'admin@nawazschool.edu');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => Boolean(window.localStorage.getItem('nawaz.admin.session.v1')),
    null,
    { timeout: 45000 }
  );

  await page.goto(`${UI}/data`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 40000 });

  await page.setInputFiles('input[type="file"]', {
    name: 'announcements.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf8'),
  });

  await page.waitForSelector('.data-import-summary, .data-preview', { timeout: 30000 }).catch(() => {});
  await page.waitForFunction(
    () => document.body.innerText.includes('announcements.csv'),
    null,
    { timeout: 30000 }
  );
  results.push(['the CSV is parsed in the browser', true]);
  results.push([
    'the preview says nothing has been saved yet',
    (await page.getByText('Preview only.', { exact: false }).count()) > 0,
  ]);

  const commitButton = page.getByRole('button', { name: /commit/i }).first();
  await commitButton.waitFor({ timeout: 30000 });
  results.push(['the commit action is enabled', await commitButton.isEnabled()]);

  const importResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/import') && response.request().method() === 'POST',
    { timeout: 60000 }
  );
  await commitButton.click();
  const imported = await importResponse;
  results.push(['commit reaches the API', imported.status() === 200]);

  const importedBody = await imported.json().catch(() => ({}));
  results.push([
    'the API reports the announcements dataset',
    Array.isArray(importedBody.imported) && importedBody.imported.includes('announcements'),
  ]);

  await page.waitForTimeout(2500);
  const afterImport = await apiState();
  results.push([
    'the new row is stored on the server',
    afterImport.announcements.some((entry) => entry.title === PROBE_TITLE),
  ]);
  results.push([
    'the server records meta.lastImport',
    Boolean(
      afterImport.meta?.lastImport &&
        (afterImport.meta.lastImport.datasets || []).includes('announcements')
    ),
  ]);
  results.push([
    'the page shows the saved-to-database card',
    (await page.locator('[data-saved-import]').count()) === 1,
  ]);

  // Reload from the API and confirm the browser sees both the persisted row
  // and the permanent "saved" card.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.goto(`${UI}/data`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-saved-import]', { timeout: 40000 }).catch(() => {});
  results.push([
    'the saved card survives a reload',
    (await page.locator('[data-saved-import]').count()) === 1,
  ]);

  await page.goto(`${UI}/announcements`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.announcement-card, .notice-card, article', { timeout: 40000 }).catch(
    () => {}
  );
  await page
    .waitForFunction((title) => document.body.innerText.includes(title), PROBE_TITLE, {
      timeout: 30000,
    })
    .catch(() => {});
  results.push([
    'the imported row survives a reload',
    (await page.getByText(PROBE_TITLE, { exact: false }).count()) > 0,
  ]);

  results.push(['no page errors', errors.length === 0]);
  if (errors.length) console.log('page errors:', errors.slice(0, 4));
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
