import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCurriculumToOffering,
  buildCurriculaFromSubjects,
  defaultSubjectCode,
  findOffering,
  gradeOfClass,
  gradeOfClassId,
  mergeChapterProgress,
  normalizeChapters,
  normalizeGrade,
} from '../src/curriculum.js';
import {
  curriculumPrompt,
  gradesFromClasses,
  parseChapterLines,
  parseCurriculumJson,
  sectionsForGrade,
} from '../../admin-panel/src/lib/curriculum.js';

test('grades come from the class record or its id/name', () => {
  assert.equal(gradeOfClass({ gradeLevel: '10', id: '10-A' }), 10);
  assert.equal(gradeOfClass({ gradeLevel: 9 }), 9);
  assert.equal(gradeOfClass({ id: '8-C', displayName: 'Class 8-C' }), 8);
  assert.equal(gradeOfClass({ displayName: 'Class 7-B' }), 7);
  assert.equal(gradeOfClass({ id: 'primary' }), null);
  assert.equal(gradeOfClassId('10-A'), 10);
  assert.equal(gradeOfClassId('nursery'), null);
});

test('only real school grades are accepted', () => {
  assert.equal(normalizeGrade(10), 10);
  assert.equal(normalizeGrade('9'), 9);
  assert.equal(normalizeGrade(0), null);
  assert.equal(normalizeGrade(13), null);
  assert.equal(normalizeGrade('ten'), null);
});

test('chapter lists accept strings and objects and reject duplicates', () => {
  const mixed = normalizeChapters(['Algebra', { title: 'Geometry' }]);
  assert.deepEqual(mixed.chapters, [{ title: 'Algebra' }, { title: 'Geometry' }]);

  assert.match(normalizeChapters([]).error, /at least one/i);
  assert.match(normalizeChapters(['A', 'a']).error, /more than once/i);
  assert.match(normalizeChapters(['  ']).error, /needs a title/i);
  assert.match(normalizeChapters('nope').error, /list/i);
});

test('progress is kept by chapter title when the curriculum changes', () => {
  const merged = mergeChapterProgress(
    [
      { title: 'Algebra', status: 'completed' },
      { title: 'Geometry', status: 'in_progress' },
      { title: 'Old chapter', status: 'completed' },
    ],
    [{ title: 'Geometry' }, { title: 'Algebra' }, { title: 'Statistics' }]
  );

  assert.deepEqual(merged, [
    { title: 'Geometry', status: 'in_progress' },
    { title: 'Algebra', status: 'completed' },
    { title: 'Statistics', status: 'pending' },
  ]);
});

test('curricula are shared per grade and subject name', () => {
  const curricula = buildCurriculaFromSubjects([
    {
      classIdSection: '10-A',
      subjectName: 'Mathematics',
      subjectCode: 'MATH-10',
      chapters: [{ title: 'Algebra' }],
    },
    {
      classIdSection: '10-B',
      subjectName: 'Mathematics',
      subjectCode: 'MATH-10',
      chapters: [{ title: 'Algebra' }],
    },
    {
      classIdSection: '9-A',
      subjectName: 'Mathematics',
      subjectCode: 'MATH-9',
      chapters: [{ title: 'Numbers' }],
    },
  ]);

  assert.equal(curricula.length, 2);
  const grade10 = curricula.find((entry) => entry.gradeLevel === 10);
  assert.equal(grade10.subjectName, 'Mathematics');
  assert.deepEqual(grade10.chapters, [{ title: 'Algebra' }]);
});

test('applying a curriculum updates the offering and preserves progress', () => {
  const curriculum = {
    id: 'cur-10-science',
    gradeLevel: 10,
    subjectName: 'Science',
    subjectCode: 'SCI-10',
    isLab: true,
    chapters: [{ title: 'Matter' }, { title: 'Energy' }],
  };
  const offering = {
    id: 'sub-10-a-sci-10',
    classIdSection: '10-A',
    subjectName: 'Science',
    chapters: [{ title: 'Matter', status: 'completed' }],
  };

  applyCurriculumToOffering(offering, curriculum);
  assert.equal(offering.curriculumId, curriculum.id);
  assert.equal(offering.isLab, true);
  assert.deepEqual(offering.chapters, [
    { title: 'Matter', status: 'completed' },
    { title: 'Energy', status: 'pending' },
  ]);
});

test('an offering is found by link or by grade and name', () => {
  const curriculum = { id: 'cur-10-math', gradeLevel: 10, subjectName: 'Mathematics' };
  const subjects = [
    { id: 'a', classIdSection: '10-A', subjectName: 'Mathematics' },
    { id: 'b', classIdSection: '10-B', subjectName: 'Mathematics', curriculumId: 'cur-10-math' },
  ];
  assert.equal(findOffering(subjects, curriculum, '10-A').id, 'a');
  assert.equal(findOffering(subjects, curriculum, '10-B').id, 'b');
  assert.equal(findOffering(subjects, curriculum, '9-A'), undefined);
});

test('default subject codes are short and grade-specific', () => {
  assert.equal(defaultSubjectCode(10, 'Mathematics'), 'MATH-10');
  assert.equal(defaultSubjectCode(9, 'Computer Science'), 'CS-9');
  assert.equal(defaultSubjectCode(8, 'Art'), 'ART-8');
});

/* ---- admin parsing helpers ---- */

test('AI JSON with a chapters array fills the editor', () => {
  const parsed = parseCurriculumJson(
    '```json\n{"subjectName":"Mathematics","subjectCode":"MATH-10","chapters":[{"title":"Algebra"},{"title":"Geometry"}]}\n```'
  );
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.subjectName, 'Mathematics');
  assert.equal(parsed.subjectCode, 'MATH-10');
  assert.deepEqual(
    parsed.chapters.map((chapter) => chapter.title),
    ['Algebra', 'Geometry']
  );
});

test('a plain numbered list is accepted and cleaned', () => {
  const parsed = parseCurriculumJson('1. Algebra\n2) Geometry\n- Statistics');
  assert.equal(parsed.usedPlainText, true);
  assert.deepEqual(
    parsed.chapters.map((chapter) => chapter.title),
    ['Algebra', 'Geometry', 'Statistics']
  );
});

test('bad JSON gives a plain-language error', () => {
  assert.match(parseCurriculumJson('{ nope').error, /not valid JSON/i);
  assert.match(parseCurriculumJson('{"chapters":[]}').error, /non-empty/i);
  assert.match(parseCurriculumJson('').error, /Paste/i);
});

test('chapter lines strip numbering', () => {
  assert.deepEqual(parseChapterLines('Chapter 1: Algebra\nChapter 2 - Geometry'), [
    'Algebra',
    'Geometry',
  ]);
});

test('admin grade helpers group sections', () => {
  const classes = [
    { id: '10-A', gradeLevel: '10' },
    { id: '10-B', gradeLevel: '10' },
    { id: '9-A', gradeLevel: '9' },
  ];
  assert.deepEqual(gradesFromClasses(classes), [10, 9]);
  assert.deepEqual(sectionsForGrade(classes, 10), ['10-A', '10-B']);
});

test('the copied prompt asks for one JSON shape', () => {
  const prompt = curriculumPrompt({ grade: 10, subjectName: 'Mathematics' });
  assert.match(prompt, /return ONLY valid JSON/i);
  assert.match(prompt, /"chapters"/);
  assert.match(prompt, /Grade 10/);
});
