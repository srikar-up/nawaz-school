/**
 * Curriculum UI helpers: grade grouping, pasted-JSON parsing and the
 * copy-paste prompt used with a syllabus photo.
 */

export function gradeLabel(grade) {
  return `Grade ${grade}`;
}

export function gradeOfClass(cls) {
  const explicit = Number(cls?.gradeLevel);
  if (Number.isInteger(explicit) && explicit >= 1 && explicit <= 12) return explicit;
  const match = String(cls?.id || '').match(/^\s*(\d{1,2})\s*[-/]/);
  return match ? Number(match[1]) : null;
}

export function gradesFromClasses(classes = []) {
  const grades = new Set();
  classes.forEach((cls) => {
    const grade = gradeOfClass(cls);
    if (grade) grades.add(grade);
  });
  return [...grades].sort((a, b) => b - a);
}

export function sectionsForGrade(classes = [], grade) {
  return classes.filter((cls) => gradeOfClass(cls) === grade).map((cls) => cls.id);
}

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

function chapterTitle(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (raw && typeof raw === 'object') {
    return String(raw.title ?? raw.name ?? raw.chapter ?? '').trim();
  }
  return '';
}

function stripFences(text) {
  const trimmed = String(text || '').trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function cleanLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*•]\s*/, '')
        .replace(/^\d+\s*[.)-]\s*/, '')
        .replace(/^chapter\s+\d+\s*[:.-]\s*/i, '')
        .trim()
    )
    .filter(Boolean);
}

export function parseChapterLines(text) {
  return cleanLines(text);
}

/**
 * Parses either an AI/JSON response or a plain list of chapter lines.
 *
 * Accepted shapes:
 *   ["Chapter 1", ...]
 *   [{ "title": "Chapter 1" }, ...]
 *   { "subjectName": "...", "chapters": [...] }
 */
export function parseCurriculumJson(text) {
  const source = stripFences(text);
  if (!source) return { error: 'Paste the JSON or one chapter per line.' };

  const looksJson = source.startsWith('{') || source.startsWith('[');
  if (!looksJson) {
    const lines = cleanLines(source);
    if (!lines.length) return { error: 'No chapter titles were found.' };
    return { chapters: lines.map((title) => ({ title })), usedPlainText: true };
  }

  let parsed;
  try {
    parsed = JSON.parse(source);
  } catch {
    return {
      error:
        'That is not valid JSON. Ask the AI to return only the JSON block, then paste it again.',
    };
  }

  const container = Array.isArray(parsed) ? { chapters: parsed } : parsed;
  if (!container || typeof container !== 'object') {
    return { error: 'Expected a JSON object with a "chapters" list.' };
  }

  const rawChapters = container.chapters ?? container.chapterTitles ?? container.syllabus;
  if (!Array.isArray(rawChapters) || !rawChapters.length) {
    return { error: 'The JSON does not contain a non-empty "chapters" list.' };
  }

  const chapters = rawChapters.map((entry) => ({ title: chapterTitle(entry) }));
  if (chapters.some((chapter) => !chapter.title)) {
    return { error: 'Every chapter needs a title.' };
  }

  return {
    chapters,
    subjectName: String(container.subjectName ?? container.name ?? '').trim(),
    subjectCode: String(container.subjectCode ?? container.code ?? '').trim(),
    gradeLevel: container.gradeLevel === undefined ? null : Number(container.gradeLevel),
    isLab: Boolean(container.isLab ?? container.lab),
  };
}

export function curriculumPrompt({ grade, subjectName } = {}) {
  const gradeText = grade ? `Grade ${grade}` : 'the grade shown on the syllabus';
  const subjectText = subjectName ? ` for ${subjectName}` : '';
  return `You are helping a school set up its syllabus in a school management system.
Read the attached syllabus image or text${subjectText} and return ONLY valid JSON.

Use this exact shape:
{
  "subjectName": "Mathematics",
  "subjectCode": "MATH-${grade || 10}",
  "gradeLevel": ${grade || 10},
  "isLab": false,
  "chapters": [
    { "title": "Chapter name exactly as printed" }
  ]
}

Rules:
- One entry per chapter, in the order printed on the syllabus.
- Keep the school's exact chapter names; do not summarise or merge them.
- Do not include unit numbers, page numbers or marks unless they are part of the chapter name.
- No markdown, no comments, no text outside the JSON.
- The grade is ${gradeText}.`;
}
