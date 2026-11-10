import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SHOTS = path.resolve('screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
});

const allErrors = [];

function watch(page, label) {
  page.on('pageerror', (error) => {
    const message = `${label} pageerror: ${error.message}`;
    allErrors.push(message);
    console.error('✗', message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (
        text.includes('favicon') ||
        text.includes('Download the React DevTools') ||
        text.includes('devtools')
      ) {
        return;
      }
      const entry = `${label} console: ${text}`;
      allErrors.push(entry);
      console.error('✗', entry);
    }
  });
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: false });
  console.log(`  screenshot: screenshots/${name}`);
}

/* ------------------------------- Teacher ------------------------------- */
{
  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  watch(page, 'teacher');

  await page.goto(`${BASE}/teacher/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Continue as Prof\. Sarah Nawaz/i }).waitFor();
  await shot(page, 'teacher-login.png');
  await page.getByRole('button', { name: /Continue as Prof\. Sarah Nawaz/i }).click();
  await page.getByText('Attendance today', { exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), '/teacher');
  await shot(page, 'teacher-home.png');
  console.log('✓ Teacher home rendered');

  for (const [route, expected, fileName] of [
    ['/teacher/attendance', 'Zero-friction roll-call', 'teacher-attendance.png'],
    ['/teacher/attendance/registry', 'Monthly registry', 'teacher-attendance-registry.png'],
    ['/teacher/classes', 'Your classroom', 'teacher-classes.png'],
    ['/teacher/tasks', 'Assessments & classwork', 'teacher-tasks.png'],
    ['/teacher/more', 'Everything else', null],
    ['/teacher/timetable', 'Weekly schedule', null],
    ['/teacher/syllabus', 'Curriculum tracker', null],
    ['/teacher/reports', 'Student progress', null],
    ['/teacher/requests', 'Private request desk', null],
    ['/teacher/notices', 'School broadcast', null],
    ['/teacher/staff', 'School directory', 'teacher-staff.png'],
    ['/teacher/profile', 'Faculty profile', null],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.getByText(expected, { exact: false }).first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(350);
    if (fileName) await shot(page, fileName);
    console.log(`✓ Teacher route ${route.replace('/teacher', '') || '/'}`);
  }

  // School-wide exams are visible, but only the assigned teacher can evaluate.
  await page.goto(`${BASE}/teacher/tasks?tab=exams`, { waitUntil: 'domcontentloaded' });
  await page.getByText('All school exams', { exact: false }).waitFor({ timeout: 15000 });
  const colleagueExamCard = page.locator('.exam-card').filter({ hasText: 'Chemistry CA-2' });
  await colleagueExamCard.waitFor();
  assert.ok(
    (await colleagueExamCard.innerText()).includes('Ms. Hina Raza'),
    'Colleague exam card should name the assigned teacher'
  );
  assert.equal(
    await colleagueExamCard.getByRole('link', { name: /Enter marks/i }).count(),
    0,
    'A colleague exam must not expose the marks-entry action'
  );
  const ownExamCard = page
    .locator('.exam-card')
    .filter({ hasText: 'Physics Mid-Term' })
    .filter({ hasText: 'Class 10-A' });
  assert.equal(
    await ownExamCard.getByRole('link', { name: /Enter marks/i }).count(),
    1,
    'The assigned teacher should still be able to enter marks on their own exam'
  );
  await page.waitForTimeout(350);
  await shot(page, 'teacher-exams-all.png');
  console.log('✓ Teacher exam list shows colleagues read-only and own evaluation action');

  await page.goto(`${BASE}/teacher/tasks/exams/EXM-005`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByText('Not your assessment', { exact: false }).waitFor();
  console.log('✓ Non-assigned open exam is blocked from marks entry');

  await page.goto(`${BASE}/teacher/tasks/exams/EXM-007`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByText('Read-only view.', { exact: false }).waitFor();
  assert.equal(
    await page.getByRole('button', { name: /Submit marks/i }).count(),
    0,
    'Read-only submitted exam must not show a submit action'
  );
  await page.waitForTimeout(350);
  await shot(page, 'teacher-exam-readonly.png');
  console.log('✓ Submitted colleague exam is viewable read-only');

  await context.close();
}

/* -------------------------------- Admin -------------------------------- */
{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  watch(page, 'admin');

  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Dr\. Tariq Nawaz/i }).waitFor();
  await shot(page, 'admin-login.png');
  await page.getByRole('button', { name: /Dr\. Tariq Nawaz/i }).click();
  await page.getByText('School tools', { exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);
  assert.equal(new URL(page.url()).pathname, '/admin/overview');
  await shot(page, 'admin-overview.png');
  console.log('✓ Admin overview rendered');

  for (const [route, expected, fileName] of [
    ['/admin/attendance', 'Class registers', 'admin-attendance.png'],
    ['/admin/attendance/registry', 'Monthly attendance', 'admin-attendance-registry.png'],
    ['/admin/students', 'Student directory', 'admin-students.png'],
    ['/admin/staff', 'People & permissions', 'admin-staff.png'],
    ['/admin/classes', 'Academic structure', 'admin-classes.png'],
    ['/admin/timetable', 'Timetable builder', 'admin-timetable.png'],
    ['/admin/exams', 'Assessment & results', 'admin-exams.png'],
    ['/admin/assignments', 'Classwork', 'admin-assignments.png'],
    ['/admin/announcements', 'School communication', 'admin-announcements.png'],
    ['/admin/requests', 'Operations desk', 'admin-requests.png'],
    ['/admin/reports', 'Insights', 'admin-reports.png'],
    ['/admin/data', 'Two-way CSV import and export', 'admin-data-exchange.png'],
    ['/admin/settings', 'School & account', 'admin-settings.png'],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.getByText(expected, { exact: false }).first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(500);
    if (fileName) await shot(page, fileName);
    console.log(`✓ Admin route ${route.replace('/admin', '') || '/'}`);
  }

  // Monthly attendance registry: student rows, month squares and class filtering.
  await page.goto(`${BASE}/admin/attendance/registry`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Monthly attendance', { exact: false }).first().waitFor();
  await page.locator('.registry-table tbody tr').first().waitFor();
  assert.ok(
    (await page.locator('.registry-square').count()) > 0,
    'monthly registry should render per-student day squares'
  );
  await page.locator('.attendance-registry-class select').selectOption('10-A');
  await page.waitForTimeout(250);
  await page.getByText('Ahmed Khan', { exact: false }).first().waitFor();
  await shot(page, 'admin-attendance-registry-class.png');
  console.log('✓ Monthly attendance registry rendered student rows and class filtering');

  // Timetable builder: settings and slot editor render without errors.
  await page.goto(`${BASE}/admin/timetable`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Timetable builder', { exact: false }).waitFor();
  await page.getByRole('button', { name: /Days & periods/i }).click();
  await page.getByRole('heading', { name: 'Week structure', exact: true }).waitFor();
  await page.waitForTimeout(300);
  await shot(page, 'admin-timetable-settings.png');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.locator('.timetable-editor-cell').first().click();
  await page.getByRole('button', { name: /Save slot/i }).waitFor();
  await page.waitForTimeout(250);
  await shot(page, 'admin-timetable-slot.png');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  console.log('✓ Timetable builder settings and slot editor opened');

  // CSV round-trip: export the full bundle, upload it, validate locally, commit.
  await page.goto(`${BASE}/admin/data`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Two-way CSV import and export', { exact: false }).waitFor();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Download full CSV bundle/i }).first().click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  assert.ok(downloadPath, 'CSV bundle download should produce a file');
  const importZip = path.join(SHOTS, 'admin-data-import-test.zip');
  fs.copyFileSync(downloadPath, importZip);
  await page.locator('input[type=file]').setInputFiles(importZip);
  await page.getByText('Local validation passed', { exact: false }).waitFor({ timeout: 20000 });
  await page.getByText('Calculated from the validated dataset', { exact: false }).waitFor();
  await page.waitForTimeout(350);
  await shot(page, 'admin-data-import-preview.png');
  console.log('✓ CSV bundle exported, re-imported and validated locally');

  await page.getByRole('button', { name: /Commit merge & sync/i }).click();
  await page.getByText('Last import synced', { exact: false }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(page, 'admin-data-imported.png');
  fs.rmSync(importZip, { force: true });
  console.log('✓ Validated CSV bundle committed and synced through the server');

  // Verify the results tab and a drawer/modal render without errors.
  await page.goto(`${BASE}/admin/exams`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Result matrix/i }).click();
  await page.getByRole('heading', { name: 'Result matrix', exact: true }).waitFor();
  await page.waitForTimeout(400);
  await shot(page, 'admin-results.png');
  console.log('✓ Admin result matrix opened');

  await page.goto(`${BASE}/admin/students`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Add student/i }).click();
  await page.getByText('Add a new student', { exact: false }).waitFor();
  await page.waitForTimeout(200);
  await shot(page, 'admin-student-modal.png');
  console.log('✓ Admin student modal opened');
  await page.keyboard.press('Escape');

  // Global search shortcut.
  await page.keyboard.press('Control+K');
  const searchInput = page.getByPlaceholder('Search a student, teacher, notice or request…');
  await searchInput.waitFor();
  await searchInput.click();
  await searchInput.fill('Sarah');
  await page.getByText('Prof. Sarah Nawaz', { exact: false }).first().waitFor();
  await page.waitForTimeout(300);
  await shot(page, 'admin-search.png');
  console.log('✓ Admin global search opened and returned results');
  await page.keyboard.press('Escape');

  await context.close();
}

/* ----------------------------- SubAdmin guard --------------------------- */
{
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  watch(page, 'subadmin');

  await page.goto(`${BASE}/admin/login`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Mr\. Usman Ali/i }).click();
  await page.getByText('School tools', { exact: true }).waitFor({ timeout: 15000 });

  await page.goto(`${BASE}/admin/staff`, { waitUntil: 'domcontentloaded' });
  await page.getByText('SuperAdmin clearance required', { exact: false }).waitFor();
  await shot(page, 'admin-subadmin-restricted.png');

  await page.goto(`${BASE}/admin/requests`, { waitUntil: 'domcontentloaded' });
  await page.getByText('Operations desk', { exact: false }).first().waitFor();
  assert.equal(
    await page.getByRole('button', { name: /Principal vault/i }).count(),
    0,
    'SubAdmin should not see the confidential vault tab'
  );
  console.log('✓ SubAdmin restrictions enforced in the UI');
  await context.close();
}

await browser.close();

if (allErrors.length) {
  console.error(`\n${allErrors.length} browser runtime error(s):`);
  allErrors.forEach((error) => console.error(` - ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nAll browser checks passed with no console or page errors.');
}
