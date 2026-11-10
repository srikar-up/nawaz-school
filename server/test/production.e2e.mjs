/**
 * Production smoke test for the three deployed origins.
 *
 * Usage:
 *   node server/test/production.e2e.mjs
 *   TEACHER_URL=... ADMIN_URL=... node server/test/production.e2e.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const TEACHER_URL = process.env.TEACHER_URL || 'https://nawaz-school-teacher.srikarsensai.workers.dev';
const ADMIN_URL = process.env.ADMIN_URL || 'https://nawaz-school-admin.srikarsensai.workers.dev';
const API_HOST = new URL(process.env.API_URL || 'https://nawaz-school-api.srikarsensai.workers.dev').host;

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

async function login(baseUrl, email, password) {
  const page = await browser.newPage();
  const errors = [];
  const apiCalls = [];

  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  page.on('request', (request) => {
    if (request.url().includes(API_HOST)) {
      apiCalls.push({
        method: request.method(),
        path: new URL(request.url()).pathname,
        auth: Boolean(request.headers().authorization),
      });
    }
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 30000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(6000);

  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 120);
  const authenticated = await page.evaluate(() =>
    Boolean(window.localStorage.getItem('nawaz.teacher.session.v1') || window.localStorage.getItem('nawaz.admin.session.v1'))
  );

  await page.close();
  return { text, authenticated, errors, apiCalls };
}

const teacher = await login(TEACHER_URL, 'teacher@nawazschool.edu', 'teacher123');
console.log('TEACHER:', JSON.stringify({
  authenticated: teacher.authenticated,
  screen: teacher.text,
  api: teacher.apiCalls.slice(0, 4),
  errors: teacher.errors.slice(0, 2),
}));

const admin = await login(ADMIN_URL, 'admin@nawazschool.edu', 'admin123');
console.log('ADMIN:', JSON.stringify({
  authenticated: admin.authenticated,
  screen: admin.text,
  api: admin.apiCalls.slice(0, 4),
  errors: admin.errors.slice(0, 2),
}));

await browser.close();

const ok =
  teacher.authenticated &&
  admin.authenticated &&
  teacher.apiCalls.every((call) => call.auth) &&
  admin.apiCalls.every((call) => call.auth);

process.exit(ok ? 0 : 1);
