import JSZip from 'jszip';
import Papa from 'papaparse';

export const CSV_FORMAT = 'nawaz-school-rms-csv';
export const CSV_FORMAT_VERSION = 1;

export const DATA_COLLECTIONS = [
  {
    key: 'meta',
    label: 'School profile',
    kind: 'object',
    primaryKey: null,
    file: 'meta.csv',
    description: 'School identity, academic year and current school day.',
    fields: [
      'schemaVersion',
      'revision',
      'schoolName',
      'shortName',
      'tagline',
      'academicYear',
      'address',
      'phone',
      'email',
      'principalName',
      'createdAt',
      'updatedAt',
      'today',
      'todayName',
      'timetableDays',
      'timetablePeriods',
      'timetableStatus',
      'timetableEditUntil',
      'timetablePublishedAt',
    ],
    required: ['schoolName', 'academicYear'],
    foreignKeys: [],
  },
  {
    key: 'staff',
    label: 'Staff & access',
    kind: 'array',
    primaryKey: 'id',
    file: 'staff.csv',
    description: 'Teachers, administrators and support staff with access levels.',
    fields: [
      'id',
      'code',
      'name',
      'email',
      'phone',
      'staffType',
      'department',
      'accessLevel',
      'isActive',
      'joinedOn',
      'avatarColor',
    ],
    required: ['id', 'name', 'email', 'staffType', 'department', 'accessLevel'],
    enums: {
      accessLevel: ['SuperAdmin', 'SubAdmin', 'TeacherApp', 'NoAccess'],
    },
    foreignKeys: [],
  },
  {
    key: 'classes',
    label: 'Classes',
    kind: 'array',
    primaryKey: 'id',
    file: 'classes.csv',
    description: 'Grade sections, rooms and class teachers.',
    fields: [
      'id',
      'gradeLevel',
      'section',
      'displayName',
      'room',
      'classTeacherId',
      'classTeacherName',
      'studentCount',
      'academicYear',
    ],
    required: ['id', 'displayName'],
    foreignKeys: [{ field: 'classTeacherId', collection: 'staff' }],
  },
  {
    key: 'students',
    label: 'Students',
    kind: 'array',
    primaryKey: 'id',
    file: 'students.csv',
    description: 'Student roster with guardian and admission details.',
    fields: [
      'id',
      'code',
      'rollNumber',
      'name',
      'classIdSection',
      'guardianName',
      'parentPhone',
      'gender',
      'dateOfBirth',
      'address',
      'admissionDate',
      'status',
      'createdAt',
    ],
    required: ['id', 'name', 'classIdSection', 'rollNumber'],
    foreignKeys: [{ field: 'classIdSection', collection: 'classes' }],
  },
  {
    key: 'subjects',
    label: 'Subjects',
    kind: 'array',
    primaryKey: 'id',
    file: 'subjects.csv',
    description: 'Subject offerings, assigned teachers and syllabus chapters.',
    fields: [
      'id',
      'subjectCode',
      'subjectName',
      'classIdSection',
      'assignedStaffId',
      'assignedTeacherName',
      'isLab',
      'chapters',
      'updatedAt',
    ],
    required: ['id', 'subjectName', 'classIdSection', 'assignedStaffId'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'assignedStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'timetable',
    label: 'Timetable',
    kind: 'array',
    primaryKey: 'id',
    file: 'timetable.csv',
    description: 'Weekly period grid for every class and teacher.',
    fields: [
      'id',
      'classIdSection',
      'className',
      'subjectId',
      'subjectCode',
      'subject',
      'teacherStaffId',
      'teacherName',
      'dayOfWeek',
      'dayName',
      'periodNumber',
      'startTime',
      'endTime',
      'room',
      'isLab',
    ],
    required: [
      'id',
      'classIdSection',
      'subjectId',
      'teacherStaffId',
      'dayOfWeek',
      'periodNumber',
    ],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'subjectId', collection: 'subjects' },
      { field: 'teacherStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'exams',
    label: 'Exams',
    kind: 'array',
    primaryKey: 'id',
    file: 'exams.csv',
    description: 'Assessment schedule, assigned teacher and marks status.',
    fields: [
      'id',
      'title',
      'classIdSection',
      'subjectId',
      'subject',
      'category',
      'date',
      'startTime',
      'endTime',
      'maxMarks',
      'assignedStaffId',
      'marksStatus',
      'createdAt',
      'submittedAt',
    ],
    required: [
      'id',
      'title',
      'classIdSection',
      'subjectId',
      'assignedStaffId',
      'date',
      'maxMarks',
    ],
    enums: {
      category: ['classTest', 'ca1', 'ca2', 'midTerm', 'endTerm'],
      marksStatus: ['Upcoming', 'Submitted', 'Locked'],
    },
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'subjectId', collection: 'subjects' },
      { field: 'assignedStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'testRecords',
    label: 'Test records',
    kind: 'array',
    primaryKey: 'id',
    file: 'testRecords.csv',
    description: 'One score record per student and assessment.',
    fields: [
      'id',
      'examId',
      'examTitle',
      'studentId',
      'studentName',
      'classIdSection',
      'subject',
      'category',
      'marksObtained',
      'maxMarks',
      'percentage',
      'enteredByStaffId',
      'enteredAt',
    ],
    required: ['id', 'examId', 'studentId', 'marksObtained', 'maxMarks'],
    foreignKeys: [
      { field: 'examId', collection: 'exams' },
      { field: 'studentId', collection: 'students' },
      { field: 'enteredByStaffId', collection: 'staff' },
    ],
    uniquePairs: [['examId', 'studentId']],
  },
  {
    key: 'assignments',
    label: 'Assignments',
    kind: 'array',
    primaryKey: 'id',
    file: 'assignments.csv',
    description: 'Classwork instructions, due dates and review state.',
    fields: [
      'id',
      'title',
      'description',
      'classIdSection',
      'subject',
      'dueDate',
      'status',
      'createdByStaffId',
      'createdAt',
    ],
    required: ['id', 'title', 'classIdSection', 'createdByStaffId'],
    enums: {
      status: ['Assigned', 'Reviewed'],
    },
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'createdByStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'attendanceSessions',
    label: 'Attendance',
    kind: 'array',
    primaryKey: 'id',
    file: 'attendanceSessions.csv',
    description: 'Class registers with nested student entries.',
    fields: [
      'id',
      'classIdSection',
      'date',
      'dayOfWeek',
      'sessionType',
      'periodNumber',
      'submittedByStaffId',
      'submittedAt',
      'entries',
    ],
    required: ['id', 'classIdSection', 'date', 'submittedByStaffId', 'entries'],
    enums: {
      sessionType: ['Morning', 'Afternoon', 'FullDay'],
    },
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'submittedByStaffId', collection: 'staff' },
    ],
    nestedEntries: true,
  },
  {
    key: 'staffAttendance',
    label: 'Staff attendance',
    kind: 'array',
    primaryKey: 'id',
    file: 'staffAttendance.csv',
    description: 'Daily check-in and leave state for staff.',
    fields: [
      'id',
      'staffId',
      'staffName',
      'date',
      'checkInTime',
      'checkOutTime',
      'status',
      'leaveReason',
    ],
    required: ['id', 'staffId', 'date', 'status'],
    enums: {
      status: ['Present', 'Absent', 'On Leave', 'Late', 'Half Day'],
    },
    foreignKeys: [{ field: 'staffId', collection: 'staff' }],
  },
  {
    key: 'classIncharges',
    label: 'Class incharges',
    kind: 'array',
    primaryKey: 'id',
    file: 'classIncharges.csv',
    description: 'Active and default class incharge assignments.',
    fields: [
      'id',
      'classIdSection',
      'defaultStaffId',
      'activeStaffId',
      'academicYear',
    ],
    required: ['id', 'classIdSection', 'activeStaffId'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'defaultStaffId', collection: 'staff' },
      { field: 'activeStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'announcements',
    label: 'Announcements',
    kind: 'array',
    primaryKey: 'id',
    file: 'announcements.csv',
    description: 'School broadcasts, priorities and audiences.',
    fields: [
      'id',
      'title',
      'body',
      'importance',
      'audience',
      'isPinned',
      'publisherName',
      'createdAt',
    ],
    required: ['id', 'title', 'body', 'importance', 'audience'],
    enums: {
      importance: ['Normal', 'Important', 'Urgent', 'Emergency'],
    },
    foreignKeys: [],
  },
  {
    key: 'rmsTickets',
    label: 'Requests & leave',
    kind: 'array',
    primaryKey: 'id',
    file: 'rmsTickets.csv',
    description: 'Staff requests, decisions and principal notes.',
    fields: [
      'id',
      'ticketNo',
      'senderStaffId',
      'senderName',
      'senderEmail',
      'category',
      'subject',
      'body',
      'room',
      'priority',
      'isConfidential',
      'status',
      'principalNote',
      'createdAt',
      'resolvedAt',
    ],
    required: ['id', 'senderStaffId', 'category', 'subject', 'status'],
    enums: {
      category: ['leave', 'maintenance', 'gear', 'confidential', 'general'],
      status: ['pending', 'underReview', 'approved', 'rejected', 'resolved'],
    },
    foreignKeys: [{ field: 'senderStaffId', collection: 'staff' }],
  },
  {
    key: 'activities',
    label: 'Activity log',
    kind: 'array',
    primaryKey: 'id',
    file: 'activities.csv',
    description: 'Lightweight audit trail shown in the admin console.',
    fields: [
      'id',
      'actorId',
      'actorName',
      'action',
      'entity',
      'entityId',
      'detail',
      'createdAt',
    ],
    required: ['id', 'action'],
    foreignKeys: [],
  },
];

const COLLECTION_BY_KEY = new Map(DATA_COLLECTIONS.map((entry) => [entry.key, entry]));
const IMPORTABLE_KEYS = new Set(DATA_COLLECTIONS.map((entry) => entry.key));

const NUMBER_FIELDS = {
  meta: ['schemaVersion', 'revision'],
  classes: ['studentCount'],
  timetable: ['periodNumber'],
  exams: ['maxMarks'],
  testRecords: ['marksObtained', 'maxMarks', 'percentage'],
  attendanceSessions: ['periodNumber'],
};

const BOOLEAN_FIELDS = {
  staff: ['isActive'],
  subjects: ['isLab'],
  timetable: ['isLab'],
  announcements: ['isPinned'],
  rmsTickets: ['isConfidential'],
};

const ATTENDANCE_STATUSES = new Set(['present', 'absent', 'late', 'excused']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function coerceFieldValue(key, field, value) {
  if (value === null || value === undefined || value === '') return value;
  const numberFields = NUMBER_FIELDS[key] || [];
  const booleanFields = BOOLEAN_FIELDS[key] || [];
  if (numberFields.includes(field)) {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  if (booleanFields.includes(field)) {
    if (value === true || /^true$/i.test(String(value))) return true;
    if (value === false || /^false$/i.test(String(value))) return false;
    if (String(value) === '1') return true;
    if (String(value) === '0') return false;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return value;
}

function coerceRowTypes(def, row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
  Object.keys(row).forEach((field) => {
    row[field] = coerceFieldValue(def.key, field, row[field]);
  });
  return row;
}

export function getCollection(key) {
  return COLLECTION_BY_KEY.get(key) || null;
}

export function getCollectionRows(data, key) {
  if (!data) return [];
  if (key === 'meta') return data.meta ? [data.meta] : [];
  return Array.isArray(data[key]) ? data[key] : [];
}

export function getCollectionCount(data, key) {
  return getCollectionRows(data, key).length;
}

export function getCollectionColumns(data, def) {
  const rows = getCollectionRows(data, def.key);
  const extras = new Set();
  rows.forEach((row) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return;
    Object.keys(row).forEach((key) => {
      if (!def.fields.includes(key)) extras.add(key);
    });
  });
  return [...def.fields, ...extras];
}

export function getCollectionStats(data) {
  return DATA_COLLECTIONS.map((def) => ({
    ...def,
    rows: getCollectionRows(data, def.key).length,
    columns: getCollectionColumns(data, def).length,
  }));
}

function escapeFormula(value) {
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function serializeCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return escapeFormula(String(value));
}

function parseCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return '';
  if (/^'[=+\-@\t\r]/.test(text)) return text.slice(1);
  if (/^true$/i.test(text)) return true;
  if (/^false$/i.test(text)) return false;
  if (/^null$/i.test(text)) return null;
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) return Number(text);
  if (
    (text.startsWith('{') && text.endsWith('}')) ||
    (text.startsWith('[') && text.endsWith(']'))
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

export function collectionToCsv(data, key) {
  const def = COLLECTION_BY_KEY.get(key);
  if (!def) throw new Error(`Unknown dataset: ${key}`);
  const rows = getCollectionRows(data, key);
  const columns = getCollectionColumns(data, def);
  const objects = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, serializeCell(row?.[column])]))
  );
  return Papa.unparse(objects, {
    columns,
    header: true,
    newline: '\r\n',
  });
}

function parseCsvText(text, def) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
  });
  const fatalErrors = result.errors.filter(
    (error) => !['TooFewFields', 'TooManyFields'].includes(error.code)
  );
  if (fatalErrors.length) {
    const first = fatalErrors[0];
    throw new Error(
      `${def.file}: ${first.message}${first.row !== undefined ? ` (row ${first.row + 2})` : ''}`
    );
  }
  const rows = result.data
    .map((raw) => {
      const row = {};
      Object.entries(raw).forEach(([column, value]) => {
        if (column) row[column] = coerceFieldValue(def.key, column, parseCell(value));
      });
      return row;
    })
    .filter((row) => Object.values(row).some((value) => value !== '' && value !== null));
  if (def.kind === 'object') {
    return rows[0] || {};
  }
  return rows;
}

function parseJsonPayload(payload, sourceName, warnings) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${sourceName}: expected a JSON object containing the school datasets.`);
  }
  const collections = {};
  Object.keys(payload).forEach((key) => {
    if (IMPORTABLE_KEYS.has(key)) collections[key] = payload[key];
  });
  if (!Object.keys(collections).length) {
    throw new Error(`${sourceName}: no recognized school datasets were found.`);
  }
  const unknown = Object.keys(payload).filter((key) => !IMPORTABLE_KEYS.has(key));
  if (unknown.length) {
    warnings.push(`Ignored unrecognized JSON keys: ${unknown.join(', ')}.`);
  }
  return collections;
}

async function parseZip(file, warnings) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const collections = {};
  const csvEntries = [];
  let jsonPayload = null;

  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const name = entry.name.split('/').pop();
    const lower = name.toLowerCase();
    if (lower === 'data.json') {
      try {
        jsonPayload = JSON.parse(await entry.async('text'));
      } catch {
        warnings.push(`${file.name}: data.json could not be parsed and was ignored.`);
      }
      continue;
    }
    if (lower === 'manifest.json' || lower === 'schema.json' || lower === 'readme.txt') continue;
    if (lower.endsWith('.csv')) csvEntries.push({ name, entry });
  }

  if (csvEntries.length) {
    for (const { name, entry } of csvEntries) {
      const key = name.replace(/\.csv$/i, '');
      const def = COLLECTION_BY_KEY.get(key);
      if (!def) {
        warnings.push(`${file.name}: ignored unknown CSV "${name}".`);
        continue;
      }
      const text = await entry.async('text');
      collections[key] = parseCsvText(text, def);
    }
    return collections;
  }

  if (jsonPayload) {
    return parseJsonPayload(jsonPayload, file.name, warnings);
  }

  throw new Error(`${file.name}: the ZIP does not contain any recognized CSV files.`);
}

export async function parseImportFiles(fileList, { onProgress } = {}) {
  const files = Array.from(fileList || []);
  if (!files.length) throw new Error('Choose a ZIP bundle or one or more CSV files to import.');
  const warnings = [];
  const collections = {};
  const sources = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    onProgress?.({ index, total: files.length, name: file.name });
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.zip')) {
      const parsed = await parseZip(file, warnings);
      Object.entries(parsed).forEach(([key, value]) => {
        if (key in collections) {
          warnings.push(`${file.name}: replaced the earlier ${key}.csv from another file.`);
        }
        collections[key] = value;
        sources.push({ file: file.name, collection: key });
      });
      continue;
    }

    if (lower.endsWith('.json')) {
      let payload;
      try {
        payload = JSON.parse(await file.text());
      } catch {
        throw new Error(`${file.name}: this is not valid JSON.`);
      }
      const parsed = parseJsonPayload(payload, file.name, warnings);
      Object.entries(parsed).forEach(([key, value]) => {
        collections[key] = value;
        sources.push({ file: file.name, collection: key });
      });
      continue;
    }

    if (lower.endsWith('.csv')) {
      const key = file.name.replace(/\.csv$/i, '');
      const def = COLLECTION_BY_KEY.get(key);
      if (!def) {
        throw new Error(
          `${file.name}: expected a dataset name such as ${DATA_COLLECTIONS.slice(0, 4)
            .map((entry) => entry.file)
            .join(', ')}.`
        );
      }
      const text = await file.text();
      collections[key] = parseCsvText(text, def);
      sources.push({ file: file.name, collection: key });
      continue;
    }

    throw new Error(`${file.name}: only .zip, .csv and .json files are supported.`);
  }

  if (!Object.keys(collections).length) {
    throw new Error('No recognized school datasets were found in the chosen files.');
  }

  return { collections, warnings, sources, files: files.map((file) => file.name) };
}

export function mergeImportedData(currentData, imported, mode = 'merge') {
  const merged = structuredClone(currentData);
  const summary = {};

  Object.entries(imported).forEach(([key, incoming]) => {
    const def = COLLECTION_BY_KEY.get(key);
    if (!def) return;

    if (key === 'meta') {
      const before = merged.meta || {};
      merged.meta = { ...before, ...(incoming || {}) };
      summary[key] = {
        label: def.label,
        mode: 'merge',
        before: 1,
        after: 1,
        added: 0,
        updated: 1,
        removed: 0,
        importedRows: 1,
      };
      return;
    }

    const currentRows = Array.isArray(merged[key]) ? merged[key] : [];
    const incomingRows = Array.isArray(incoming) ? incoming : [];
    const primaryKey = def.primaryKey;

    if (mode === 'replace') {
      const beforeKeys = new Set(
        currentRows.map((row) => String(row?.[primaryKey] ?? '')).filter(Boolean)
      );
      const incomingKeys = new Set(
        incomingRows.map((row) => String(row?.[primaryKey] ?? '')).filter(Boolean)
      );
      merged[key] = incomingRows.map((row) => ({ ...row }));
      summary[key] = {
        label: def.label,
        mode: 'replace',
        before: currentRows.length,
        after: incomingRows.length,
        added: [...incomingKeys].filter((id) => !beforeKeys.has(id)).length,
        updated: [...incomingKeys].filter((id) => beforeKeys.has(id)).length,
        removed: [...beforeKeys].filter((id) => !incomingKeys.has(id)).length,
        importedRows: incomingRows.length,
      };
      return;
    }

    const map = new Map();
    currentRows.forEach((row) => {
      const id = row?.[primaryKey];
      if (id !== undefined && id !== null && String(id).trim()) {
        map.set(String(id), { ...row });
      }
    });
    let added = 0;
    let updated = 0;
    incomingRows.forEach((row) => {
      const id = row?.[primaryKey];
      const mapKey =
        id !== undefined && id !== null && String(id).trim()
          ? String(id)
          : `__invalid_${map.size}_${Math.random()}`;
      if (map.has(mapKey)) {
        map.set(mapKey, { ...map.get(mapKey), ...row });
        updated += 1;
      } else {
        map.set(mapKey, { ...row });
        added += 1;
      }
    });
    merged[key] = [...map.values()];
    summary[key] = {
      label: def.label,
      mode: 'merge',
      before: currentRows.length,
      after: merged[key].length,
      added,
      updated,
      removed: 0,
      importedRows: incomingRows.length,
    };
  });

  return { merged, summary };
}

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeSchoolData(data) {
  const normalized = structuredClone(data);
  DATA_COLLECTIONS.forEach((def) => {
    if (def.key === 'meta') {
      if (normalized.meta) coerceRowTypes(def, normalized.meta);
      return;
    }
    if (Array.isArray(normalized[def.key])) {
      normalized[def.key].forEach((row) => coerceRowTypes(def, row));
    }
  });
  const staffById = new Map(
    (normalized.staff || []).map((member) => [String(member.id), member])
  );
  const classesById = new Map(
    (normalized.classes || []).map((cls) => [String(cls.id), cls])
  );
  const studentsById = new Map(
    (normalized.students || []).map((student) => [String(student.id), student])
  );
  const examsById = new Map(
    (normalized.exams || []).map((exam) => [String(exam.id), exam])
  );

  const countsByClass = new Map();
  (normalized.students || []).forEach((student) => {
    const key = String(student.classIdSection || '');
    countsByClass.set(key, (countsByClass.get(key) || 0) + 1);
  });

  (normalized.classes || []).forEach((cls) => {
    cls.studentCount = countsByClass.get(String(cls.id)) || 0;
    const teacher = staffById.get(String(cls.classTeacherId || ''));
    if (teacher) cls.classTeacherName = teacher.name;
    if (!cls.academicYear && normalized.meta?.academicYear) {
      cls.academicYear = normalized.meta.academicYear;
    }
  });

  (normalized.subjects || []).forEach((subject) => {
    const teacher = staffById.get(String(subject.assignedStaffId || ''));
    if (teacher) subject.assignedTeacherName = teacher.name;
  });

  (normalized.timetable || []).forEach((period) => {
    const teacher = staffById.get(String(period.teacherStaffId || ''));
    if (teacher) period.teacherName = teacher.name;
    const cls = classesById.get(String(period.classIdSection || ''));
    if (cls) period.className = cls.displayName;
  });

  (normalized.staffAttendance || []).forEach((record) => {
    const member = staffById.get(String(record.staffId || ''));
    if (member) record.staffName = member.name;
  });

  (normalized.classIncharges || []).forEach((incharge) => {
    if (!incharge.academicYear && normalized.meta?.academicYear) {
      incharge.academicYear = normalized.meta.academicYear;
    }
  });

  (normalized.testRecords || []).forEach((record) => {
    const student = studentsById.get(String(record.studentId || ''));
    if (student) {
      record.studentName = student.name;
      record.classIdSection = student.classIdSection;
    }
    const exam = examsById.get(String(record.examId || ''));
    const maxMarks = asNumber(record.maxMarks) ?? asNumber(exam?.maxMarks);
    const marks = asNumber(record.marksObtained);
    if (maxMarks && maxMarks > 0 && marks !== null) {
      record.percentage = Math.round((marks / maxMarks) * 1000) / 10;
    }
  });

  return normalized;
}

export function validateSchoolData(data, { actorId } = {}) {
  const errors = [];
  const warnings = [];
  const rowsByKey = {};
  const mapsByKey = {};
  const pushError = (collection, row, field, message) => {
    errors.push({ collection, row, field, message });
  };
  const pushWarning = (collection, row, field, message) => {
    warnings.push({ collection, row, field, message });
  };

  if (!data?.meta || typeof data.meta !== 'object' || Array.isArray(data.meta)) {
    pushError('meta', 0, 'meta', 'The school profile is missing. Import meta.csv first.');
  } else {
    if (!String(data.meta.schoolName || '').trim()) {
      pushError('meta', 0, 'schoolName', 'School name is required.');
    }
    if (!String(data.meta.academicYear || '').trim()) {
      pushError('meta', 0, 'academicYear', 'Academic year is required.');
    }
  }

  DATA_COLLECTIONS.forEach((def) => {
    if (def.kind !== 'array') return;
    const rows = data?.[def.key];
    if (!Array.isArray(rows)) {
      pushError(def.key, 0, def.key, `${def.label} must be a CSV table.`);
      rowsByKey[def.key] = [];
      mapsByKey[def.key] = new Map();
      return;
    }
    rowsByKey[def.key] = rows;
    const map = new Map();
    rows.forEach((row, index) => {
      const rowNumber = index + 1;
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        pushError(def.key, rowNumber, '', 'Row is not a data object.');
        return;
      }
      if (def.primaryKey) {
        const id = row[def.primaryKey];
        if (id === undefined || id === null || !String(id).trim()) {
          pushError(def.key, rowNumber, def.primaryKey, `Missing ${def.primaryKey}.`);
        } else if (map.has(String(id))) {
          pushError(
            def.key,
            rowNumber,
            def.primaryKey,
            `Duplicate ${def.primaryKey} "${id}".`
          );
        } else {
          map.set(String(id), row);
        }
      }
      def.required.forEach((field) => {
        if (field === def.primaryKey) return;
        const value = row[field];
        if (value === undefined || value === null || String(value).trim() === '') {
          pushError(def.key, rowNumber, field, `${field} is required.`);
        }
      });
      Object.entries(def.enums || {}).forEach(([field, allowed]) => {
        if (row[field] === undefined || row[field] === '') return;
        if (!allowed.includes(row[field])) {
          pushError(
            def.key,
            rowNumber,
            field,
            `${field} must be one of: ${allowed.join(', ')}.`
          );
        }
      });
    });
    mapsByKey[def.key] = map;

    if (def.key === 'staff') {
      if (!rows.length) {
        pushError(def.key, 0, def.key, 'At least one staff record is required.');
      } else if (
        !rows.some(
          (member) => member.accessLevel === 'SuperAdmin' && member.isActive !== false
        )
      ) {
        pushError(def.key, 0, 'accessLevel', 'At least one active SuperAdmin is required.');
      }
    }
    if (def.key === 'classes' && !rows.length) {
      pushError(def.key, 0, def.key, 'At least one class is required.');
    }
  });

  if (actorId && !mapsByKey.staff?.has(String(actorId))) {
    pushError(
      'staff',
      0,
      'id',
      'The import would remove the administrator who is currently signed in.'
    );
  }

  DATA_COLLECTIONS.forEach((def) => {
    if (def.kind !== 'array') return;
    const rows = rowsByKey[def.key] || [];
    const rowsByIndex = new Map(rows.map((row, index) => [index, row]));

    (def.foreignKeys || []).forEach((fk) => {
      const target = mapsByKey[fk.collection];
      if (!target) return;
      rows.forEach((row, index) => {
        const value = row?.[fk.field];
        if (value === undefined || value === null || String(value).trim() === '') return;
        if (!target.has(String(value))) {
          pushError(
            def.key,
            index + 1,
            fk.field,
            `${fk.field} "${value}" does not exist in ${fk.collection}.id.`
          );
        }
      });
    });

    (def.uniquePairs || []).forEach((pair) => {
      const seen = new Map();
      rows.forEach((row, index) => {
        const key = pair.map((field) => String(row?.[field] ?? '')).join('::');
        if (pair.some((field) => !String(row?.[field] ?? '').trim())) return;
        if (seen.has(key)) {
          pushError(
            def.key,
            index + 1,
            pair.join(' + '),
            `Duplicate ${pair.join(' + ')} combination (also row ${seen.get(key)}).`
          );
        } else {
          seen.set(key, index + 1);
        }
      });
    });

    if (def.key === 'students') {
      const seenRolls = new Map();
      rows.forEach((row, index) => {
        const key = `${row?.classIdSection || ''}::${row?.rollNumber || ''}`;
        if (!row?.classIdSection || !row?.rollNumber) return;
        if (seenRolls.has(key)) {
          pushError(
            def.key,
            index + 1,
            'rollNumber',
            `Roll number "${row.rollNumber}" is duplicated in ${row.classIdSection} (also row ${seenRolls.get(key)}).`
          );
        } else {
          seenRolls.set(key, index + 1);
        }
      });
    }

    if (def.key === 'exams') {
      rows.forEach((row, index) => {
        const maxMarks = asNumber(row?.maxMarks);
        if (maxMarks === null || maxMarks <= 0) {
          pushError(def.key, index + 1, 'maxMarks', 'maxMarks must be greater than zero.');
        }
        if (row?.date && !DATE_RE.test(String(row.date))) {
          pushError(def.key, index + 1, 'date', 'date must use YYYY-MM-DD.');
        }
        ['startTime', 'endTime'].forEach((field) => {
          if (row?.[field] && !TIME_RE.test(String(row[field]))) {
            pushError(def.key, index + 1, field, `${field} must use HH:mm.`);
          }
        });
      });
    }

    if (def.key === 'testRecords') {
      rows.forEach((row, index) => {
        const marks = asNumber(row?.marksObtained);
        const maxMarks = asNumber(row?.maxMarks);
        if (marks === null || marks < 0) {
          pushError(def.key, index + 1, 'marksObtained', 'Marks must be zero or more.');
        }
        if (maxMarks === null || maxMarks <= 0) {
          pushError(def.key, index + 1, 'maxMarks', 'maxMarks must be greater than zero.');
        } else if (marks !== null && marks > maxMarks) {
          pushError(def.key, index + 1, 'marksObtained', 'Marks cannot exceed maxMarks.');
        }
      });
    }

    if (def.key === 'attendanceSessions') {
      const students = mapsByKey.students || new Map();
      rows.forEach((row, index) => {
        if (!Array.isArray(row?.entries)) {
          pushError(def.key, index + 1, 'entries', 'entries must be a JSON array.');
          return;
        }
        const seenStudents = new Set();
        row.entries.forEach((entry, entryIndex) => {
          if (!entry || typeof entry !== 'object') {
            pushError(
              def.key,
              index + 1,
              'entries',
              `Entry ${entryIndex + 1} is not a data object.`
            );
            return;
          }
          if (!entry.studentId || !students.has(String(entry.studentId))) {
            pushError(
              def.key,
              index + 1,
              'entries.studentId',
              `Entry ${entryIndex + 1} references an unknown student "${entry.studentId || ''}".`
            );
          }
          if (!ATTENDANCE_STATUSES.has(entry.status)) {
            pushError(
              def.key,
              index + 1,
              'entries.status',
              `Entry ${entryIndex + 1} has invalid status "${entry.status || ''}".`
            );
          }
          if (entry.studentId) {
            if (seenStudents.has(String(entry.studentId))) {
              pushWarning(
                def.key,
                index + 1,
                'entries.studentId',
                `Student "${entry.studentId}" appears more than once in the register.`
              );
            }
            seenStudents.add(String(entry.studentId));
            const student = students.get(String(entry.studentId));
            if (student && student.classIdSection !== row.classIdSection) {
              pushWarning(
                def.key,
                index + 1,
                'entries.studentId',
                `Student "${entry.studentId}" is in ${student.classIdSection}, not ${row.classIdSection}.`
              );
            }
          }
        });
      });
    }

    if (def.key === 'staffAttendance') {
      const allowed = new Set(['Present', 'Absent', 'On Leave', 'Late', 'Half Day']);
      rows.forEach((row, index) => {
        if (row?.status && !allowed.has(row.status)) {
          pushWarning(
            def.key,
            index + 1,
            'status',
            `Uncommon staff attendance status "${row.status}" will be kept as-is.`
          );
        }
      });
    }

    if (def.key === 'activities') {
      const staff = mapsByKey.staff || new Map();
      rows.forEach((row, index) => {
        if (row?.actorId && !staff.has(String(row.actorId))) {
          pushWarning(
            def.key,
            index + 1,
            'actorId',
            `Activity actor "${row.actorId}" is not in the staff table.`
          );
        }
      });
    }

    if (rowsByIndex.size && def.key === 'assignments') {
      rows.forEach((row, index) => {
        if (row?.dueDate && !DATE_RE.test(String(row.dueDate))) {
          pushWarning(def.key, index + 1, 'dueDate', 'dueDate should use YYYY-MM-DD.');
        }
      });
    }
  });

  const attendanceEntries = (rowsByKey.attendanceSessions || []).flatMap(
    (session) => session.entries || []
  );
  const attendanceCounts = attendanceEntries.reduce(
    (counts, entry) => {
      if (entry.status === 'present') counts.present += 1;
      if (entry.status === 'absent') counts.absent += 1;
      if (entry.status === 'late') counts.late += 1;
      if (entry.status === 'excused') counts.excused += 1;
      return counts;
    },
    { present: 0, absent: 0, late: 0, excused: 0 }
  );
  const attendanceTotal = attendanceEntries.length;
  const attendanceRate = attendanceTotal
    ? Math.round(
        ((attendanceCounts.present + attendanceCounts.late * 0.5) / attendanceTotal) * 1000
      ) / 10
    : 0;

  const scores = (rowsByKey.testRecords || [])
    .map((record) => asNumber(record.percentage))
    .filter((value) => value !== null);
  const scoreAverage = scores.length
    ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
    : 0;
  const belowThreshold = scores.filter((value) => value < 35).length;
  const openExams = (rowsByKey.exams || []).filter((exam) => {
    if (['Submitted', 'Locked'].includes(exam.marksStatus)) return false;
    const end = new Date(`${exam.date}T${exam.endTime || '23:59'}:00`);
    return !Number.isNaN(end.getTime()) && end < new Date();
  }).length;

  const counts = Object.fromEntries(
    DATA_COLLECTIONS.map((def) => [def.key, getCollectionRows(data, def.key).length])
  );

  return {
    errors,
    warnings,
    counts,
    calculations: {
      attendanceTotal,
      attendanceRate,
      ...attendanceCounts,
      scores: scores.length,
      scoreAverage,
      belowThreshold,
      openExams,
      students: counts.students,
      staff: counts.staff,
      classes: counts.classes,
      sessions: counts.attendanceSessions,
      exams: counts.exams,
    },
  };
}

export function buildImportPreview(parsed, currentData, mode, { actorId } = {}) {
  const { merged, summary } = mergeImportedData(currentData, parsed.collections, mode);
  const normalized = normalizeSchoolData(merged);
  const validation = validateSchoolData(normalized, { actorId });
  return {
    ...validation,
    data: normalized,
    summary,
    sources: parsed.sources || [],
    fileNames: parsed.files || [],
    parseWarnings: parsed.warnings || [],
    mode,
  };
}

export async function buildExportBundle(data) {
  const zip = new JSZip();
  const exportedAt = new Date().toISOString();
  const counts = Object.fromEntries(
    DATA_COLLECTIONS.map((def) => [def.key, getCollectionRows(data, def.key).length])
  );
  const manifest = {
    format: CSV_FORMAT,
    formatVersion: CSV_FORMAT_VERSION,
    exportedAt,
    schoolName: data.meta?.schoolName || '',
    academicYear: data.meta?.academicYear || '',
    schemaVersion: data.meta?.schemaVersion || '',
    counts,
    files: DATA_COLLECTIONS.map((def) => def.file),
  };

  DATA_COLLECTIONS.forEach((def) => {
    zip.file(def.file, collectionToCsv(data, def.key));
  });

  const schema = {
    format: CSV_FORMAT,
    formatVersion: CSV_FORMAT_VERSION,
    exportedAt,
    collections: DATA_COLLECTIONS.map((def) => ({
      ...def,
      rows: counts[def.key],
    })),
  };
  zip.file('schema.json', JSON.stringify(schema, null, 2));
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file(
    'data.json',
    JSON.stringify(
      Object.fromEntries(DATA_COLLECTIONS.map((def) => [def.key, data[def.key]])),
      null,
      2
    )
  );
  zip.file(
    'README.txt',
    [
      'Nawaz School RMS — CSV data bundle',
      `Exported: ${exportedAt}`,
      `School: ${manifest.schoolName} (${manifest.academicYear})`,
      '',
      'Each CSV file maps to one dataset. Keep the file names unchanged.',
      'meta.csv contains one row with the school profile.',
      'Nested values such as attendance entries and syllabus chapters are stored as JSON inside the cell.',
      '',
      'Import this whole ZIP in Admin → Data exchange, or import individual CSV files named:',
      ...DATA_COLLECTIONS.map((def) => `- ${def.file} (${def.label})`),
      '',
      'The admin app parses and validates every file locally before anything is written.',
    ].join('\r\n')
  );

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return {
    blob,
    manifest,
    fileName: `nawaz-school-data-${new Date().toISOString().slice(0, 10)}.zip`,
  };
}

export function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadCollectionCsv(data, key) {
  const csv = collectionToCsv(data, key);
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `${key}.csv`
  );
}

export function downloadSchema(data) {
  const schema = {
    format: CSV_FORMAT,
    formatVersion: CSV_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    collections: DATA_COLLECTIONS.map((def) => ({
      ...def,
      rows: getCollectionRows(data, def.key).length,
    })),
  };
  downloadBlob(
    new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' }),
    'nawaz-school-schema.json'
  );
}

export function downloadImportErrors(errors) {
  const csv = Papa.unparse(
    errors.map((error) => ({
      collection: error.collection,
      row: error.row || '',
      field: error.field || '',
      message: error.message,
    })),
    { header: true, newline: '\r\n' }
  );
  downloadBlob(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    `nawaz-import-errors-${new Date().toISOString().slice(0, 10)}.csv`
  );
}

export function collectionLabel(key) {
  return COLLECTION_BY_KEY.get(key)?.label || key;
}

export { COLLECTION_BY_KEY, IMPORTABLE_KEYS };
