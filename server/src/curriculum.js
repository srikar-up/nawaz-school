/**
 * Curriculum helpers.
 *
 * A curriculum is the shared syllabus for one grade standard, for example
 * "Grade 10 Mathematics". Every section of that grade (10-A, 10-B, ...) gets
 * its own subject offering with the same chapter list, so teachers keep their
 * own progress while the admin edits the standard once.
 */

export const MAX_CHAPTERS = 100;
export const MAX_CHAPTER_TITLE = 160;
export const CHAPTER_STATUSES = ['pending', 'in_progress', 'completed'];

export function normalizeGrade(value) {
  const grade = Number(value);
  return Number.isInteger(grade) && grade >= 1 && grade <= 12 ? grade : null;
}

/** Grade for a class record, falling back to the "10-A" id shape. */
export function gradeOfClass(cls) {
  const explicit = normalizeGrade(cls?.gradeLevel);
  if (explicit) return explicit;

  const fromId = String(cls?.id || '').match(/^\s*(\d{1,2})\s*[-/]/);
  if (fromId) return normalizeGrade(fromId[1]);

  const fromName = String(cls?.displayName || '').match(/\b(\d{1,2})\b/);
  return fromName ? normalizeGrade(fromName[1]) : null;
}

export function gradeOfClassId(classId) {
  const fromId = String(classId || '').match(/^\s*(\d{1,2})\s*[-/]/);
  return fromId ? normalizeGrade(fromId[1]) : null;
}

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

export function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function defaultSubjectCode(grade, name) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const base =
    words.length > 1
      ? words.map((word) => word[0]).join('')
      : (words[0] || 'SUB').slice(0, 4);
  return `${base.toUpperCase()}-${grade}`;
}

function chapterTitle(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object') {
    return String(raw.title ?? raw.name ?? raw.chapter ?? '').trim();
  }
  return '';
}

/**
 * Validates a chapters array from the admin UI or API.
 * Accepts plain strings or `{ title }` objects.
 */
export function normalizeChapters(input) {
  if (!Array.isArray(input)) {
    return { chapters: [], error: 'Chapters must be a list.' };
  }
  if (!input.length) {
    return { chapters: [], error: 'Add at least one chapter.' };
  }
  if (input.length > MAX_CHAPTERS) {
    return { chapters: [], error: `Keep the list to ${MAX_CHAPTERS} chapters or fewer.` };
  }

  const chapters = [];
  const seen = new Set();
  for (let index = 0; index < input.length; index += 1) {
    const title = chapterTitle(input[index]);
    if (!title) {
      return { chapters: [], error: `Chapter ${index + 1} needs a title.` };
    }
    if (title.length > MAX_CHAPTER_TITLE) {
      return {
        chapters: [],
        error: `Chapter ${index + 1} is too long. Keep it under ${MAX_CHAPTER_TITLE} characters.`,
      };
    }
    const key = title.toLowerCase();
    if (seen.has(key)) {
      return { chapters: [], error: `"${title}" appears more than once.` };
    }
    seen.add(key);
    chapters.push({ title });
  }

  return { chapters };
}

/**
 * Rebuilds a class offering's chapters from the curriculum, keeping each
 * chapter's saved progress by title. New chapters start as pending and removed
 * chapters disappear.
 */
export function mergeChapterProgress(existing = [], chapters = []) {
  const statusByTitle = new Map();
  (Array.isArray(existing) ? existing : []).forEach((chapter) => {
    const title = chapterTitle(chapter);
    if (!title) return;
    statusByTitle.set(
      title.toLowerCase(),
      CHAPTER_STATUSES.includes(chapter.status) ? chapter.status : 'pending'
    );
  });

  return chapters.map((chapter) => {
    const title = chapterTitle(chapter);
    return {
      title,
      status: statusByTitle.get(title.toLowerCase()) || 'pending',
    };
  });
}

/** Shared curricula derived from existing class offerings (one per grade + name). */
export function buildCurriculaFromSubjects(subjects = []) {
  const byKey = new Map();

  subjects.forEach((subject) => {
    const grade = gradeOfClassId(subject?.classIdSection);
    if (!grade) return;
    const name = String(subject.subjectName || '').trim();
    if (!name) return;

    const key = `${grade}::${normalizeName(name)}`;
    if (byKey.has(key)) return;

    byKey.set(key, {
      id: `cur-${grade}-${slugify(name)}`,
      gradeLevel: grade,
      subjectName: name,
      subjectCode: subject.subjectCode || defaultSubjectCode(grade, name),
      isLab: Boolean(subject.isLab),
      chapters: (subject.chapters || [])
        .map((chapter) => ({ title: chapterTitle(chapter) }))
        .filter((chapter) => chapter.title),
      updatedAt: new Date().toISOString(),
    });
  });

  return [...byKey.values()].sort(
    (a, b) => b.gradeLevel - a.gradeLevel || a.subjectName.localeCompare(b.subjectName)
  );
}

/** Finds the class offering that belongs to a curriculum, if any. */
export function findOffering(subjects, curriculum, classId) {
  const byLink = subjects.find(
    (subject) =>
      subject.classIdSection === classId && subject.curriculumId === curriculum.id
  );
  if (byLink) return byLink;

  const name = normalizeName(curriculum.subjectName);
  return subjects.find(
    (subject) =>
      subject.classIdSection === classId &&
      normalizeName(subject.subjectName) === name
  );
}

/** Applies a curriculum to one offering object, preserving progress. */
export function applyCurriculumToOffering(offering, curriculum) {
  offering.curriculumId = curriculum.id;
  offering.subjectName = curriculum.subjectName;
  offering.subjectCode =
    curriculum.subjectCode || defaultSubjectCode(curriculum.gradeLevel, curriculum.subjectName);
  offering.isLab = Boolean(curriculum.isLab);
  offering.chapters = mergeChapterProgress(offering.chapters, curriculum.chapters);
  offering.updatedAt = new Date().toISOString();
  return offering;
}
