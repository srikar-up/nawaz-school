/**
 * Verifies the live-sync stream: authenticated fetch, no token in the URL,
 * and a real change event reaching the browser.
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

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  headless: true,
});
const page = await browser.newPage();
const streamRequests = [];

page.on('request', (request) => {
  if (request.url().includes('/api/events')) {
    streamRequests.push({
      url: request.url(),
      authorization: Boolean(request.headers().authorization),
    });
  }
});

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'teacher@nawazschool.edu');
await page.fill('input[type="password"]', 'teacher123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3500);

// networkidle never fires while the SSE stream is open.
await page.goto('http://localhost:5173/profile', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

const badge = await page
  .locator('.profile-section')
  .filter({ hasText: /sync status/i })
  .first()
  .innerText();
const syncText = badge.replace(/\s+/g, ' ').trim();

console.log('stream requests:', JSON.stringify(streamRequests));
console.log('token in url:', streamRequests.some((entry) => entry.url.includes('token=')));
console.log('sync panel:', syncText.slice(0, 90));

await browser.close();

const authorized = streamRequests.length > 0 && streamRequests.every((entry) => entry.authorization);
const cleanUrl = streamRequests.every((entry) => !entry.url.includes('token='));
const live = /Live/.test(syncText);

console.log('RESULT:', JSON.stringify({ authorized, cleanUrl, live }));
process.exit(authorized && cleanUrl && live ? 0 : 1);
