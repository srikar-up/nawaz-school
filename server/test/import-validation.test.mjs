import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { buildSeed } from '../src/seed.js';
import { normalizeImportedData, validateImportedData } from '../src/import-validation.js';

describe('import validation', () => {
  test('accepts a subject that is not assigned to a teacher yet', () => {
    const db = buildSeed();
    db.subjects[0].assignedStaffId = '';
    db.subjects[0].assignedTeacherName = 'Unassigned';
    normalizeImportedData(db);
    const errors = validateImportedData(db, { actorId: 'STF-001' });
    assert.deepEqual(
      errors.filter((error) => error.collection === 'subjects'),
      []
    );
  });

  test('accepts an exam whose subject has no assigned teacher', () => {
    const db = buildSeed();
    const exam = db.exams[0];
    exam.assignedStaffId = '';
    const subject = db.subjects.find((entry) => entry.id === exam.subjectId);
    if (subject) subject.assignedStaffId = '';
    normalizeImportedData(db);
    const errors = validateImportedData(db, { actorId: 'STF-001' });
    assert.deepEqual(
      errors.filter((error) => error.collection === 'exams'),
      []
    );
  });

  test('still rejects an assignedStaffId that is not in the staff table', () => {
    const db = buildSeed();
    db.subjects[0].assignedStaffId = 'STF-NOT-REAL';
    normalizeImportedData(db);
    const errors = validateImportedData(db, { actorId: 'STF-001' });
    assert.ok(
      errors.some(
        (error) =>
          error.collection === 'subjects' &&
          error.field === 'assignedStaffId' &&
          error.message.includes('does not exist')
      )
    );
  });
});
