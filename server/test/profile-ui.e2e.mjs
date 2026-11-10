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

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'teacher@nawazschool.edu');
await page.fill('input[type="password"]', 'teacher123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);

await page.goto('http://localhost:5173/profile', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

const pickerCount = await page.locator('.photo-picker').count();
const addButton = page.getByRole('button', { name: /add photo|replace/i }).first();
const hasAdd = await addButton.count();

// Generate a PNG on disk so the real <input type=file> path is exercised.
const png = await page.evaluate(async () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1200;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 1200, 1200);
  g.addColorStop(0, '#16A34A');
  g.addColorStop(1, '#0EA5E9');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1200, 1200);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 420px sans-serif';
  ctx.fillText('SN', 330, 760);
  return canvas.toDataURL('image/png');
});

const tmpFile = path.join(process.env.TEMP, 'ui-avatar.png');
fs.writeFileSync(tmpFile, Buffer.from(png.split(',')[1], 'base64'));

await page.setInputFiles('input[type="file"]', tmpFile);

const patchResponse = await page
  .waitForResponse((r) => r.url().includes('/api/staff/STF-002/photo'), { timeout: 45000 })
  .catch(() => null);

await page.waitForTimeout(2500);

const avatarSrc = await page.locator('.photo-picker img').first().getAttribute('src').catch(() => null);

console.log('picker rendered:', pickerCount, '| add button:', hasAdd);
console.log('PATCH status:', patchResponse ? patchResponse.status() : 'none');
console.log('avatar src:', avatarSrc);
console.log('console errors:', JSON.stringify(errors.slice(0, 3)));

await browser.close();
fs.unlinkSync(tmpFile);
