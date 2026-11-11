/**
 * Data-exchange export check.
 *
 * Confirms the curriculum dataset is included in the downloadable CSV bundle
 * and documented in the generated schema. Requires the dev servers.
 *
 *   node server/test/data-exchange.e2e.mjs
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

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
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));

  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"]', { timeout: 40000 });
  await page.fill('input[type="email"]', 'admin@nawazschool.edu');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => Boolean(window.localStorage.getItem('nawaz.admin.session.v1')),
    null,
    { timeout: 45000 }
  );

  await page.goto('http://localhost:5174/data', { waitUntil: 'domcontentloaded' });
  const exportButton = page.getByRole('button', { name: /download full csv bundle/i });
  await exportButton.waitFor({ timeout: 40000 });

  const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
  await exportButton.click();
  const download = await downloadPromise;
  const tempFile = path.join(process.env.TEMP, `nawaz-export-${Date.now()}.zip`);
  await download.saveAs(tempFile);

  const zip = await JSZip.loadAsync(fs.readFileSync(tempFile));
  const files = Object.keys(zip.files);
  results.push(['bundle contains a curricula file', files.includes('curricula.csv')]);

  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  results.push([
    'manifest counts curricula rows',
    Number.isInteger(manifest.counts?.curricula) && manifest.counts.curricula > 0,
  ]);

  const schema = JSON.parse(await zip.file('schema.json').async('string'));
  const definition = schema.collections.find((entry) => entry.key === 'curricula');
  results.push(['schema documents the curricula dataset', Boolean(definition)]);
  results.push([
    'curricula fields cover grade and chapters',
    Boolean(definition) &&
      definition.fields.includes('gradeLevel') &&
      definition.fields.includes('chapters'),
  ]);

  const csv = await zip.file('curricula.csv').async('string');
  results.push([
    'curricula CSV has a grade column',
    csv.split(/\r?\n/)[0].includes('gradeLevel'),
  ]);

  results.push(['no page errors', errors.length === 0]);
  if (errors.length) console.log('page errors:', errors.slice(0, 3));

  fs.unlinkSync(tempFile);
  await page.close();
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
