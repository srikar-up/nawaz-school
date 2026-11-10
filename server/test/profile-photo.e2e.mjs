import { chromium } from 'playwright-core';
import fs from 'node:fs';
import os from 'node:os';
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
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });

await page.fill('input[type="email"]', 'teacher@nawazschool.edu');
await page.fill('input[type="password"]', 'teacher123');
await page.click('button[type="submit"]');

await page.waitForTimeout(4000);

const afterLogin = await page.evaluate(() => ({
  path: window.location.pathname,
  hasNav: Boolean(document.querySelector('nav, .bottom-nav, .app-shell, main')),
  text: document.body.innerText.slice(0, 120).replace(/\s+/g, ' '),
}));

console.log('AFTER LOGIN:', JSON.stringify(afterLogin));

const imageResult = await page.evaluate(async () => {
  const { toWebp } = await import('/src/lib/image.js');

  const source = document.createElement('canvas');
  source.width = 1600;
  source.height = 900;
  const ctx = source.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 1600, 900);
  gradient.addColorStop(0, '#4338CA');
  gradient.addColorStop(1, '#F59E0B');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1600, 900);

  const blob = await new Promise((resolve) => source.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'portrait.png', { type: 'image/png' });
  const converted = await toWebp(file);

  const bitmap = await createImageBitmap(converted);
  return {
    inputBytes: file.size,
    outputType: converted.type,
    outputBytes: converted.size,
    width: bitmap.width,
    height: bitmap.height,
  };
});

console.log('IMAGE PIPELINE:', JSON.stringify(imageResult));

const uploadResult = await page.evaluate(async () => {
  const { toWebp } = await import('/src/lib/image.js');
  const { uploadProfilePhoto } = await import('/src/lib/upload.js');

  const source = document.createElement('canvas');
  source.width = 900;
  source.height = 900;
  const ctx = source.getContext('2d');
  ctx.fillStyle = '#0EA5E9';
  ctx.fillRect(0, 0, 900, 900);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 300px sans-serif';
  ctx.fillText('T', 330, 620);

  const blob = await new Promise((resolve) => source.toBlob(resolve, 'image/png'));
  const file = await toWebp(new File([blob], 'avatar.png', { type: 'image/png' }));

  try {
    const saved = await uploadProfilePhoto(file, { kind: 'staff', id: 'STF-002' });
    return { ok: true, photo: saved.photo };
  } catch (error) {
    return { ok: false, error: String(error.message || error) };
  }
});

console.log('UPLOAD:', JSON.stringify(uploadResult));
console.log('CONSOLE ERRORS:', JSON.stringify(errors.slice(0, 5)));

await browser.close();
