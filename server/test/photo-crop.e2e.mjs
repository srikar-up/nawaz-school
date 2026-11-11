/**
 * Profile photo crop + preview flow, against an isolated API.
 *
 * Spawns its own API (:4100, temporary JSON database, test-only Cloudinary
 * folder prefix) and a teacher dev server (:5175) pointed at it. The real
 * Firestore data and the real Cloudinary `school/` folder are never touched.
 *
 *   node server/test/photo-crop.e2e.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_DIR = path.join(ROOT, 'server');
const TEACHER_DIR = path.join(ROOT, 'teacher-app');
const API = 'http://127.0.0.1:4100';
const UI = 'http://127.0.0.1:5175';
const FOLDER_PREFIX = 'test/nawaz-school';
const STAFF_ID = 'STF-002';

const CHROME = path.join(
  process.env.LOCALAPPDATA || '',
  'ms-playwright',
  'chromium-1254',
  'chrome-win',
  'chrome.exe'
);

const envFile = fs.readFileSync(path.join(SERVER_DIR, '.env'), 'utf8');
const envValue = (key) =>
  envFile
    .split(/\r?\n/)
    .find((line) => line.startsWith(`${key}=`))
    ?.slice(key.length + 1);

const API_KEY = envValue('FIREBASE_API_KEY');
const cloudinaryEnv = {
  CLOUDINARY_CLOUD_NAME: envValue('CLOUDINARY_CLOUD_NAME') || '',
  CLOUDINARY_API_KEY: envValue('CLOUDINARY_API_KEY') || '',
  CLOUDINARY_API_SECRET: envValue('CLOUDINARY_API_SECRET') || '',
  CLOUDINARY_FOLDER_PREFIX: FOLDER_PREFIX,
};

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nawaz-photo-crop-'));
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

async function call(pathname, { method = 'GET', body, token } = {}) {
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

/* ------------------------------------------------------------------ */
/* Minimal PNG so the test does not depend on image assets on disk.    */
/* ------------------------------------------------------------------ */

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const name = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, crc]);
}

function makePortrait(width = 900, height = 600) {
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const index = row + 1 + x * 3;
      const dx = x - width / 2;
      const dy = y - height / 2;
      const face = dx * dx + dy * dy < (Math.min(width, height) * 0.3) ** 2;
      raw[index] = face ? 244 : Math.round(67 + (x / width) * 120);
      raw[index + 1] = face ? 180 : Math.round(56 + (y / height) * 110);
      raw[index + 2] = face ? 120 : 200;
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ------------------------------------------------------------------ */

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});

const results = [];
let photoSaved = false;

try {
  start(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: {
      ...process.env,
      ...cloudinaryEnv,
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
      '--host',
      '127.0.0.1',
    ],
    { cwd: TEACHER_DIR, env: { ...process.env, VITE_API_URL: API } }
  );

  await waitFor(`${API}/api/health`);
  await waitFor(UI);

  const token = await signIn('teacher@nawazschool.edu', 'teacher123');
  const before = await call('/api/state', { token });
  const beforePhoto = before.body.staff.find((member) => member.id === STAFF_ID)?.photo || null;
  results.push(['test starts with no photo on the isolated seed', beforePhoto === null]);

  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') pageErrors.push(message.text());
  });

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

  await page.goto(`${UI}/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.photo-picker-frame', { timeout: 40000 });

  // ---------- cancel path ----------
  let uploads = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('api.cloudinary.com')) uploads += 1;
  });

  await page.setInputFiles('input[type="file"]', {
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: makePortrait(),
  });
  await page.waitForSelector('.photo-crop-overlay', { timeout: 15000 });
  await page.getByRole('button', { name: /cancel/i }).last().click();
  await page.waitForSelector('.photo-crop-overlay', { state: 'detached', timeout: 15000 }).catch(() => {});
  results.push(['cancel closes the crop dialog', (await page.locator('.photo-crop-overlay').count()) === 0]);
  results.push(['cancel uploads nothing', uploads === 0]);

  // ---------- crop + preview ----------
  await page.setInputFiles('input[type="file"]', {
    name: 'portrait.png',
    mimeType: 'image/png',
    buffer: makePortrait(),
  });
  await page.waitForSelector('.photo-crop-overlay', { timeout: 15000 });
  results.push([
    'crop dialog explains the adjustment',
    /adjust your profile photo/i.test(await page.locator('#photo-crop-title').innerText()),
  ]);

  await page.waitForFunction(
    () => {
      const image = document.querySelector('.photo-crop-stage img');
      return Boolean(image && image.complete && image.naturalWidth > 0);
    },
    null,
    { timeout: 15000 }
  );
  const stage = await page.evaluate(() => {
    const image = document.querySelector('.photo-crop-stage img');
    return { width: image.naturalWidth, height: image.naturalHeight };
  });
  results.push(['stage shows the selected photo', stage.width === 900 && stage.height === 600]);

  await page.waitForFunction(
    () => {
      const previews = [...document.querySelectorAll('.photo-crop-preview img')];
      return previews.length === 2 && previews.every((image) => image.complete && image.naturalWidth > 0);
    },
    null,
    { timeout: 15000 }
  );
  results.push(['two avatar previews render', (await page.locator('.photo-crop-preview').count()) === 2]);

  const zoom = page.locator('.photo-crop-zoom input[type="range"]');
  await zoom.evaluate((element) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(element, '1.8');
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  results.push(['zoom control applies a new scale', (await zoom.inputValue()) === '1.8']);

  await page.getByRole('button', { name: /rotate right/i }).click();
  const rotatedTransform = await page.locator('.photo-crop-stage img').evaluate((image) => image.style.transform);
  results.push(['rotate turns the photo', /rotate\(90deg\)/.test(rotatedTransform)]);

  const box = await page.locator('.photo-crop-stage').boundingBox();
  const beforeDrag = await page.locator('.photo-crop-stage img').evaluate((image) => image.style.transform);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 32, box.y + box.height / 2 + 18, { steps: 6 });
  await page.mouse.up();
  const afterDrag = await page.locator('.photo-crop-stage img').evaluate((image) => image.style.transform);
  results.push(['dragging repositions the photo', afterDrag !== beforeDrag]);

  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/staff/${STAFF_ID}/photo`) &&
      response.request().method() === 'PATCH',
    { timeout: 60000 }
  );
  await page.getByRole('button', { name: /save photo/i }).click();
  const saved = await saveResponse;
  photoSaved = saved.status() === 200;
  results.push(['saving the crop uploads and persists the photo', saved.status() === 200]);

  const savedBody = await saved.json().catch(() => ({}));
  results.push([
    'saved photo uses the test-only folder',
    String(savedBody.photo?.publicId || '').startsWith(`${FOLDER_PREFIX}/staff/`),
  ]);

  await page.waitForFunction(
    ({ publicId }) => {
      const image = document.querySelector('.photo-picker-frame img');
      return Boolean(
        image && image.complete && image.naturalWidth > 0 && image.src.includes(publicId)
      );
    },
    { publicId: savedBody.photo?.publicId },
    { timeout: 45000 }
  );
  results.push(['profile picker shows the saved photo', true]);

  const rawSize = await page.evaluate(
    (url) =>
      new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve(null);
        image.src = url;
      }),
    savedBody.photo?.url
  );
  results.push(['saved avatar is a 512px square', rawSize?.width === 512 && rawSize?.height === 512]);

  // ---------- the photo follows the user across the app ----------
  await page.goto(`${UI}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.avatar-hero', { timeout: 40000 });
  await page
    .waitForFunction(
      () => {
        const image = document.querySelector('.avatar-hero');
        return Boolean(image && image.complete && image.naturalWidth > 0);
      },
      null,
      { timeout: 30000 }
    )
    .catch(() => {});
  const homeShot = await page.evaluate((publicId) => {
    const image = document.querySelector('.avatar-hero');
    return {
      tag: image?.tagName || '',
      loaded: Boolean(image && image.complete && image.naturalWidth > 0),
      matches: Boolean(image && image.src.includes(publicId)),
    };
  }, savedBody.photo?.publicId);
  results.push(['home hero shows the photo', homeShot.tag === 'IMG' && homeShot.loaded && homeShot.matches]);

  await page.goto(`${UI}/more`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.profile-summary-card', { timeout: 40000 });
  await page
    .waitForFunction(
      (publicId) => {
        const image = document.querySelector('.profile-summary-card img.avatar');
        return Boolean(image && image.complete && image.naturalWidth > 0 && image.src.includes(publicId));
      },
      savedBody.photo?.publicId,
      { timeout: 30000 }
    )
    .catch(() => {});
  const moreShot = await page.evaluate((publicId) => {
    const image = document.querySelector('.profile-summary-card img.avatar');
    return {
      loaded: Boolean(image && image.complete && image.naturalWidth > 0),
      matches: Boolean(image && image.src.includes(publicId)),
    };
  }, savedBody.photo?.publicId);
  results.push(['more profile card shows the photo', moreShot.loaded && moreShot.matches]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.profile-summary-card', { timeout: 40000 });
  await page
    .waitForFunction(
      (publicId) => {
        const image = document.querySelector('.profile-summary-card img.avatar');
        return Boolean(image && image.complete && image.naturalWidth > 0 && image.src.includes(publicId));
      },
      savedBody.photo?.publicId,
      { timeout: 30000 }
    )
    .catch(() => {});
  const afterReload = await page.evaluate((publicId) => {
    const image = document.querySelector('.profile-summary-card img.avatar');
    return Boolean(image && image.complete && image.naturalWidth > 0 && image.src.includes(publicId));
  }, savedBody.photo?.publicId);
  results.push(['photo survives a reload', afterReload]);

  const state = await call('/api/state', { token });
  const stored = state.body.staff.find((member) => member.id === STAFF_ID)?.photo;
  results.push(['photo metadata is stored on the staff record', stored?.publicId === savedBody.photo?.publicId]);

  results.push(['no page errors', pageErrors.length === 0]);
  if (pageErrors.length) console.log('page errors:', pageErrors.slice(0, 4));

  await page.close();
} finally {
  const token = await signIn('teacher@nawazschool.edu', 'teacher123').catch(() => null);
  if (token && photoSaved) {
    await call(`/api/staff/${STAFF_ID}/photo`, { method: 'DELETE', token }).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
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
