#!/usr/bin/env node
/**
 * Scale report for 1,000 students / 50 teachers.
 *
 *   node server/scripts/load-test.mjs
 *   node server/scripts/load-test.mjs --students 1500 --days 90
 *
 * The default is a pure model: it builds a realistic term in memory and prints
 * document sizes, cold-start reads and write amplification. It does not touch
 * Firestore, so it is safe to run anywhere.
 *
 * `--write --yes` performs a real Firestore write into an isolated namespace
 * named `school_loadtest_*`. It is intentionally guarded because writing ~10k
 * documents costs money on a production project.
 */
import { buildScaleFixture, measureScale } from '../src/scale.js';

function arg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1] ?? fallback;
}

const options = {
  studentCount: Number(arg('students', '1000')),
  staffCount: Number(arg('staff', '50')),
  sectionCount: Number(arg('sections', '30')),
  schoolDays: Number(arg('days', '60')),
  examCycles: Number(arg('exams', '4')),
};

for (const [key, value] of Object.entries(options)) {
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`--${key} must be a positive number.`);
    process.exit(1);
  }
}

const db = buildScaleFixture(options);
const report = measureScale(db);

console.log('');
console.log(
  `Scale model: ${report.students} students · ${report.staff} staff · ${report.sections} sections`
);
console.log(
  `Documents: ${report.recordDocuments} record + ${report.configDocuments} config · cold start reads ${report.coldStartReads}`
);
console.log(
  `Largest document: ${(report.largestDocument / 1024).toFixed(1)} KiB · total state ${(
    report.totalStateBytes / 1024
  ).toFixed(1)} KiB`
);
console.log(
  `Writes per register: ${report.writesPerAttendanceSubmission} · per class marks: ${report.writesPerMarksSubmission}`
);
console.log('');
console.log('Collection'.padEnd(22), 'Rows'.padStart(7), 'Doc KiB'.padStart(10), 'Largest KiB'.padStart(12), 'Layout');
for (const [key, entry] of Object.entries(report.collections)
  .sort((a, b) => b[1].documentBytes - a[1].documentBytes)
  .slice(0, 15)) {
  console.log(
    key.padEnd(22),
    String(entry.rows).padStart(7),
    (entry.documentBytes / 1024).toFixed(1).padStart(10),
    (entry.largestRecordBytes / 1024).toFixed(1).padStart(12),
    entry.layout
  );
}
console.log('');
console.log(report.overLimit ? 'FAIL: a document crosses the safety limit.' : 'PASS: every document is under the safety limit.');

if (process.argv.includes('--write')) {
  if (!process.argv.includes('--yes')) {
    console.error('Refusing to write without --yes.');
    process.exit(1);
  }
  const root = String(process.env.FIRESTORE_ROOT || '');
  if (!root.startsWith('school_loadtest_')) {
    console.error('Set FIRESTORE_ROOT to an isolated school_loadtest_* namespace first.');
    process.exit(1);
  }
  process.env.DATA_BACKEND = 'firestore';
  const { saveDbToFirestore, clearFirestore } = await import('../src/firestore-store.js');
  const started = Date.now();
  const result = await saveDbToFirestore(db, null);
  console.log(
    `Wrote ${result.writes} document(s), deleted ${result.deletes} legacy document(s) in ${
      Date.now() - started
    } ms.`
  );
  if (process.argv.includes('--clean')) {
    await clearFirestore();
    console.log('Removed the load-test namespace.');
  }
}
