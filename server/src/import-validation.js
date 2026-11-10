import { SCHEMA_VERSION } from './seed.js';

export const IMPORT_COLLECTIONS = [
  { key: 'meta', kind: 'object', primaryKey: null },
  { key: 'staff', kind: 'array', primaryKey: 'id', required: ['id', 'name', 'email', 'accessLevel'] },
  { key: 'classes', kind: 'array', primaryKey: 'id', required: ['id', 'displayName'] },
  {
    key: 'students',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'name', 'classIdSection', 'rollNumber'],
    foreignKeys: [{ field: 'classIdSection', collection: 'classes' }],
  },
  {
    key: 'subjects',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'subjectName', 'classIdSection', 'assignedStaffId'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'assignedStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'timetable',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'classIdSection', 'subjectId', 'teacherStaffId'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'subjectId', collection: 'subjects' },
      { field: 'teacherStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'exams',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'title', 'classIdSection', 'subjectId', 'assignedStaffId', 'date', 'maxMarks'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'subjectId', collection: 'subjects' },
      { field: 'assignedStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'testRecords',
    kind: 'array',
    primaryKey: 'id',
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
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'title', 'classIdSection', 'createdByStaffId'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'createdByStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'attendanceSessions',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'classIdSection', 'date', 'submittedByStaffId', 'entries'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'submittedByStaffId', collection: 'staff' },
    ],
    nestedEntries: true,
  },
  {
    key: 'staffAttendance',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'staffId', 'date', 'status'],
    foreignKeys: [{ field: 'staffId', collection: 'staff' }],
  },
  {
    key: 'classIncharges',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'classIdSection', 'activeStaffId'],
    foreignKeys: [
      { field: 'classIdSection', collection: 'classes' },
      { field: 'defaultStaffId', collection: 'staff' },
      { field: 'activeStaffId', collection: 'staff' },
    ],
  },
  {
    key: 'announcements',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'title', 'body', 'importance', 'audience'],
  },
  {
    key: 'rmsTickets',
    kind: 'array',
    primaryKey: 'id',
    required: ['id', 'senderStaffId', 'category', 'subject', 'status'],
    foreignKeys: [{ field: 'senderStaffId', collection: 'staff' }],
  },
  { key: 'activities', kind: 'array', primaryKey: 'id', required: ['id', 'action'] },
];

const COLLECTION_BY_KEY = new Map(IMPORT_COLLECTIONS.map((entry) => [entry.key, entry]));
export const IMPORT_COLLECTION_KEYS = new Set(IMPORT_COLLECTIONS.map((entry) => entry.key));
const ATTENDANCE_STATUSES = new Set(['present', 'absent', 'late', 'excused']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function empty(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function mergeImport(current, incoming, mode) {
  const merged = structuredClone(current);
  const summary = {};

  Object.entries(incoming).forEach(([key, value]) => {
    const def = COLLECTION_BY_KEY.get(key);
    if (!def) return;
    if (key === 'meta') {
      merged.meta = { ...(merged.meta || {}), ...(value || {}) };
      summary[key] = { label: 'School profile', before: 1, after: 1, added: 0, updated: 1, removed: 0 };
      return;
    }

    const currentRows = Array.isArray(merged[key]) ? merged[key] : [];
    const incomingRows = Array.isArray(value) ? value : [];

    if (mode === 'replace') {
      const beforeKeys = new Set(
        currentRows.map((row) => String(row?.[def.primaryKey] ?? '')).filter(Boolean)
      );
      const incomingKeys = new Set(
        incomingRows.map((row) => String(row?.[def.primaryKey] ?? '')).filter(Boolean)
      );
      merged[key] = incomingRows.map((row) => ({ ...row }));
      summary[key] = {
        label: key,
        before: currentRows.length,
        after: incomingRows.length,
        added: [...incomingKeys].filter((id) => !beforeKeys.has(id)).length,
        updated: [...incomingKeys].filter((id) => beforeKeys.has(id)).length,
        removed: [...beforeKeys].filter((id) => !incomingKeys.has(id)).length,
      };
      return;
    }

    const map = new Map();
    currentRows.forEach((row) => {
      const id = row?.[def.primaryKey];
      if (!empty(id)) map.set(String(id), { ...row });
    });
    let added = 0;
    let updated = 0;
    incomingRows.forEach((row) => {
      const id = row?.[def.primaryKey];
      const mapKey = empty(id) ? `__invalid_${map.size}` : String(id);
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
      label: key,
      before: currentRows.length,
      after: merged[key].length,
      added,
      updated,
      removed: 0,
    };
  });

  return { merged, summary };
}

export function normalizeImportedData(data) {
  const staffById = new Map(
    (data.staff || []).map((member) => [String(member.id), member])
  );
  const classesById = new Map(
    (data.classes || []).map((cls) => [String(cls.id), cls])
  );
  const studentsById = new Map(
    (data.students || []).map((student) => [String(student.id), student])
  );
  const examsById = new Map((data.exams || []).map((exam) => [String(exam.id), exam]));

  const countsByClass = new Map();
  (data.students || []).forEach((student) => {
    if (student && student.rollNumber !== undefined && student.rollNumber !== null) {
      student.rollNumber = String(student.rollNumber);
    }
    const key = String(student?.classIdSection || '');
    countsByClass.set(key, (countsByClass.get(key) || 0) + 1);
  });

  (data.classes || []).forEach((cls) => {
    cls.studentCount = countsByClass.get(String(cls.id)) || 0;
    const teacher = staffById.get(String(cls.classTeacherId || ''));
    if (teacher) cls.classTeacherName = teacher.name;
    if (!cls.academicYear && data.meta?.academicYear) cls.academicYear = data.meta.academicYear;
  });

  (data.subjects || []).forEach((subject) => {
    const teacher = staffById.get(String(subject.assignedStaffId || ''));
    if (teacher) subject.assignedTeacherName = teacher.name;
  });

  (data.timetable || []).forEach((period) => {
    const teacher = staffById.get(String(period.teacherStaffId || ''));
    if (teacher) period.teacherName = teacher.name;
    const cls = classesById.get(String(period.classIdSection || ''));
    if (cls) period.className = cls.displayName;
  });

  (data.staffAttendance || []).forEach((record) => {
    const member = staffById.get(String(record.staffId || ''));
    if (member) record.staffName = member.name;
  });

  (data.classIncharges || []).forEach((incharge) => {
    if (!incharge.academicYear && data.meta?.academicYear) {
      incharge.academicYear = data.meta.academicYear;
    }
  });

  (data.testRecords || []).forEach((record) => {
    const student = studentsById.get(String(record.studentId || ''));
    if (student) {
      record.studentName = student.name;
      record.classIdSection = student.classIdSection;
    }
    const exam = examsById.get(String(record.examId || ''));
    const marks = numberOrNull(record.marksObtained);
    const maxMarks = numberOrNull(record.maxMarks) ?? numberOrNull(exam?.maxMarks);
    if (maxMarks && maxMarks > 0 && marks !== null) {
      record.percentage = Math.round((marks / maxMarks) * 1000) / 10;
    }
  });

  return data;
}

export function validateImportedData(data, { actorId } = {}) {
  const errors = [];
  const push = (collection, row, field, message) =>
    errors.push({ collection, row, field, message });

  if (errors.length > 250) return errors;

  if (!data?.meta || typeof data.meta !== 'object' || Array.isArray(data.meta)) {
    push('meta', 0, 'meta', 'The school profile is missing.');
  } else {
    if (empty(data.meta.schoolName)) push('meta', 0, 'schoolName', 'School name is required.');
    if (empty(data.meta.academicYear)) {
      push('meta', 0, 'academicYear', 'Academic year is required.');
    }
    if (
      data.meta.schemaVersion !== undefined &&
      String(data.meta.schemaVersion) !== String(SCHEMA_VERSION)
    ) {
      push(
        'meta',
        0,
        'schemaVersion',
        `This backup uses schema ${data.meta.schemaVersion}; this server expects ${SCHEMA_VERSION}.`
      );
    }
  }

  const rowsByKey = {};
  const mapsByKey = {};

  IMPORT_COLLECTIONS.forEach((def) => {
    if (def.kind !== 'array') return;
    const rows = data?.[def.key];
    if (!Array.isArray(rows)) {
      push(def.key, 0, def.key, `${def.key} must be a table.`);
      rowsByKey[def.key] = [];
      mapsByKey[def.key] = new Map();
      return;
    }
    rowsByKey[def.key] = rows;
    const map = new Map();
    rows.forEach((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        push(def.key, index + 1, '', 'Row is not a data object.');
        return;
      }
      const id = row[def.primaryKey];
      if (empty(id)) {
        push(def.key, index + 1, def.primaryKey, `Missing ${def.primaryKey}.`);
      } else if (map.has(String(id))) {
        push(def.key, index + 1, def.primaryKey, `Duplicate ${def.primaryKey} "${id}".`);
      } else {
        map.set(String(id), row);
      }
      (def.required || []).forEach((field) => {
        if (field === def.primaryKey) return;
        if (empty(row[field])) push(def.key, index + 1, field, `${field} is required.`);
      });
    });
    mapsByKey[def.key] = map;

    if (def.key === 'staff') {
      if (!rows.length) push('staff', 0, 'staff', 'At least one staff record is required.');
      else if (
        !rows.some((member) => member.accessLevel === 'SuperAdmin' && member.isActive !== false)
      ) {
        push('staff', 0, 'accessLevel', 'At least one active SuperAdmin is required.');
      }
    }
    if (def.key === 'classes' && !rows.length) {
      push('classes', 0, 'classes', 'At least one class is required.');
    }
  });

  if (actorId && !mapsByKey.staff?.has(String(actorId))) {
    push(
      'staff',
      0,
      'id',
      'The import would remove the administrator who is currently signed in.'
    );
  }

  IMPORT_COLLECTIONS.forEach((def) => {
    if (def.kind !== 'array') return;
    const rows = rowsByKey[def.key] || [];
    (def.foreignKeys || []).forEach((fk) => {
      const target = mapsByKey[fk.collection];
      if (!target) return;
      rows.forEach((row, index) => {
        const value = row?.[fk.field];
        if (empty(value)) return;
        if (!target.has(String(value))) {
          push(
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
        if (pair.some((field) => empty(row?.[field]))) return;
        const key = pair.map((field) => String(row[field])).join('::');
        if (seen.has(key)) {
          push(
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

    if (def.key === 'exams') {
      rows.forEach((row, index) => {
        const maxMarks = numberOrNull(row?.maxMarks);
        if (maxMarks === null || maxMarks <= 0) {
          push(def.key, index + 1, 'maxMarks', 'maxMarks must be greater than zero.');
        }
        if (row?.date && !DATE_RE.test(String(row.date))) {
          push(def.key, index + 1, 'date', 'date must use YYYY-MM-DD.');
        }
        ['startTime', 'endTime'].forEach((field) => {
          if (row?.[field] && !TIME_RE.test(String(row[field]))) {
            push(def.key, index + 1, field, `${field} must use HH:mm.`);
          }
        });
      });
    }

    if (def.key === 'testRecords') {
      rows.forEach((row, index) => {
        const marks = numberOrNull(row?.marksObtained);
        const maxMarks = numberOrNull(row?.maxMarks);
        if (marks === null || marks < 0) {
          push(def.key, index + 1, 'marksObtained', 'Marks must be zero or more.');
        }
        if (maxMarks === null || maxMarks <= 0) {
          push(def.key, index + 1, 'maxMarks', 'maxMarks must be greater than zero.');
        } else if (marks !== null && marks > maxMarks) {
          push(def.key, index + 1, 'marksObtained', 'Marks cannot exceed maxMarks.');
        }
      });
    }

    if (def.key === 'attendanceSessions') {
      const students = mapsByKey.students || new Map();
      rows.forEach((row, index) => {
        if (!Array.isArray(row?.entries)) {
          push(def.key, index + 1, 'entries', 'entries must be a JSON array.');
          return;
        }
        row.entries.forEach((entry, entryIndex) => {
          if (!entry || typeof entry !== 'object') {
            push(def.key, index + 1, 'entries', `Entry ${entryIndex + 1} is not an object.`);
            return;
          }
          if (empty(entry.studentId) || !students.has(String(entry.studentId))) {
            push(
              def.key,
              index + 1,
              'entries.studentId',
              `Entry ${entryIndex + 1} references an unknown student.`
            );
          }
          if (!ATTENDANCE_STATUSES.has(entry.status)) {
            push(
              def.key,
              index + 1,
              'entries.status',
              `Entry ${entryIndex + 1} has invalid status "${entry.status || ''}".`
            );
          }
        });
      });
    }
  });

  return errors;
}

export function collectionSummary(merged, importedKeys) {
  return Object.fromEntries(
    importedKeys.map((key) => {
      const def = COLLECTION_BY_KEY.get(key);
      if (!def) return [key, { rows: 0 }];
      if (key === 'meta') return [key, { rows: 1 }];
      return [key, { rows: Array.isArray(merged[key]) ? merged[key].length : 0 }];
    })
  );
}
