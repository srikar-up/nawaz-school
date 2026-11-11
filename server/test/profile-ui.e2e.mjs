/**
 * Profile-photo UI smoke test against the running dev servers.
 *
 * Opens the crop dialog from the real profile page and cancels it, so no
 * Cloudinary asset is created. The full save path is covered by the isolated
 * `photo-crop.e2e.mjs`.
 *
 *   node server/test/profile-ui.e2e.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = path.join(
  process.env.LOCALAPPDATA || '',
  'ms-playwright',
  'chromium-1254',
  'chrome-win',
  'chrome.exe'
);

const results = [];
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', 'teacher@nawazschool.edu');
  await page.fill('input[type="password"]', 'teacher123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => Boolean(window.localStorage.getItem('nawaz.teacher.session.v1')),
    null,
    { timeout: 45000 }
  );

  await page.goto('http://localhost:5173/profile', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.photo-picker-frame', { timeout: 40000 });

  results.push(['profile shows the photo picker', (await page.locator('.photo-picker').count()) === 1]);
  results.push([
    'picker is editable by the signed-in teacher',
    await page.locator('.photo-picker-frame').isEnabled(),
  ]);

  const dataUrl = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 600;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 900, 600);
    gradient.addColorStop(0, '#16a34a');
    gradient.addColorStop(1, '#0ea5e9');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 900, 600);
    context.fillStyle = '#ffffff';
    context.font = 'bold 260px sans-serif';
    context.fillText('SN', 260, 390);
    return canvas.toDataURL('image/png');
  });

  let photoPatches = 0;
  page.on('request', (request) => {
    if (request.method() === 'PATCH' && request.url().includes('/photo')) photoPatches += 1;
  });

  await page.setInputFiles('input[type="file"]', {
    name: 'avatar.png',
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.split(',')[1], 'base64'),
  });

  await page.waitForSelector('.photo-crop-overlay', { timeout: 15000 });
  await page.waitForSelector('.photo-crop-preview img', { timeout: 15000 });
  results.push(['crop dialog opens from the profile', true]);
  results.push(['crop dialog shows two previews', (await page.locator('.photo-crop-preview').count()) === 2]);

  await page.getByRole('button', { name: /cancel/i }).last().click();
  await page
    .waitForSelector('.photo-crop-overlay', { state: 'detached', timeout: 15000 })
    .catch(() => {});
  results.push(['cancel closes the crop dialog', (await page.locator('.photo-crop-overlay').count()) === 0]);
  results.push(['cancel does not save a photo', photoPatches === 0]);
  results.push(['no console errors', errors.length === 0]);
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
