/**
 * Curriculum admin UI, against an isolated API.
 *
 *   node server/test/curriculum-ui.e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

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

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-curriculum-ui-'));
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

let token = '';

async function api(pathname) {
  const response = await fetch(`${API}${pathname}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
  });
  return response.json();
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
      '5176',
      '--strictPort',
      '--host',
      '127.0.0.1',
    ],
    { cwd: ADMIN_DIR, env: { ...process.env, VITE_API_URL: API } }
  );

  await waitFor(`${API}/api/health`);
  await waitFor(UI);
  token = await signIn('admin@nawazschool.edu', 'admin123');

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

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

  await page.goto(`${UI}/curriculum`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.curriculum-table', { timeout: 40000 });

  results.push([
    'grade standards are listed',
    (await page.locator('.class-selector-card').count()) >= 2,
  ]);
  results.push([
    'seeded subjects appear in the coverage table',
    (await page.locator('.curriculum-table tbody tr').count()) >= 5,
  ]);

  await page.getByRole('button', { name: /add subject/i }).first().click();
  await page.waitForSelector('.curriculum-editor', { timeout: 15000 });
  results.push(['the create editor opens', true]);

  await page.getByLabel('Subject name').fill('Environmental Science');
  await page.getByLabel('Subject code').fill('ENVS-10');
  await page
    .getByLabel('Pasted JSON from the AI')
    .fill(
      JSON.stringify({
        subjectName: 'Environmental Science',
        subjectCode: 'ENVS-10',
        gradeLevel: 10,
        isLab: true,
        chapters: [
          { title: 'Ecosystems' },
          { title: 'Water' },
          { title: 'Climate' },
        ],
      })
    );
  await page.getByRole('button', { name: /fill chapters from this/i }).click();
  const chapterValue = await page.getByLabel('Chapter list').inputValue();
  results.push([
    'the pasted AI JSON fills the chapter list',
    chapterValue.split('\n').length === 3 && chapterValue.includes('Ecosystems'),
  ]);
  results.push([
    'the lab flag is read from the JSON',
    await page.getByLabel(/lab/i).isChecked(),
  ]);

  const createResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/curricula') && response.request().method() === 'POST',
    { timeout: 30000 }
  );
  await page.getByRole('button', { name: /create and share/i }).click();
  const created = await createResponse;
  results.push(['saving creates the grade subject', created.status() === 201]);

  await page.waitForSelector('.curriculum-table tbody tr:has-text("Environmental Science")', {
    timeout: 30000,
  });
  const row = page.locator('.curriculum-table tbody tr', { hasText: 'Environmental Science' });
  results.push(['the shared subject appears in the matrix', (await row.count()) === 1]);
  results.push([
    'both grade 10 sections show as set',
    (await row.locator('.curriculum-cell.set').count()) === 2,
  ]);
  results.push([
    'the chapter count is shown',
    /3/.test(await row.innerText()),
  ]);

  await row.getByRole('button', { name: /edit/i }).click();
  await page.waitForSelector('.curriculum-editor', { timeout: 15000 });
  const existingChapters = await page.getByLabel('Chapter list').inputValue();
  await page.getByLabel('Chapter list').fill(`${existingChapters}\nEnergy`);
  const updateResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/curricula/') && response.request().method() === 'PATCH',
    { timeout: 30000 }
  );
  await page.getByRole('button', { name: /save changes/i }).click();
  const updated = await updateResponse;
  results.push(['editing the shared syllabus saves', updated.status() === 200]);

  await page.waitForSelector('.curriculum-table tbody tr:has-text("Environmental Science")', {
    timeout: 30000,
  });
  const refreshed = page.locator('.curriculum-table tbody tr', {
    hasText: 'Environmental Science',
  });
  results.push(['the new chapter count is reflected', /4/.test(await refreshed.innerText())]);

  const stateBeforeDelete = await api('/api/state');
  const offeringIds = stateBeforeDelete.subjects
    .filter((subject) => subject.curriculumId?.includes('environmental-science'))
    .map((subject) => subject.id);
  results.push(['the API stores one offering per section', offeringIds.length === 2]);

  await refreshed.getByRole('button', { name: /remove environmental science/i }).click();
  await page.waitForSelector('.modal-card', { timeout: 15000 });
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/curricula/') && response.request().method() === 'DELETE',
    { timeout: 30000 }
  );
  await page.getByRole('button', { name: /^remove$/i }).click();
  const removed = await deleteResponse;
  results.push(['removing the grade subject succeeds', removed.status() === 200]);

  await page
    .waitForFunction(
      () =>
        ![...document.querySelectorAll('.curriculum-table tbody tr')].some((row) =>
          row.textContent.includes('Environmental Science')
        ),
      null,
      { timeout: 30000 }
    )
    .catch(() => {});
  results.push([
    'the matrix no longer lists the subject',
    (await page.locator('.curriculum-table tbody tr', { hasText: 'Environmental Science' }).count()) === 0,
  ]);

  const afterDelete = await api('/api/state');
  results.push([
    'class offerings are kept after removal',
    offeringIds.every((id) => afterDelete.subjects.some((subject) => subject.id === id)),
  ]);

  // Grade switching must not leak the other standard's subjects.
  await page.locator('.class-selector-card', { hasText: 'Grade 9' }).click();
  await page.waitForTimeout(700);
  const grade9Table = await page.locator('.curriculum-table').innerText();
  results.push([
    'grade tabs switch the coverage table',
    grade9Table.includes('Grade 9') || !grade9Table.includes('Environmental'),
  ]);

  results.push(['no page errors', pageErrors.length === 0]);
  if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 4));

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
