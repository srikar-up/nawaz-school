import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { getBackendName, getDb, getDatabaseFile, initStoreAsync, mutate, resetStore, storeEvents } from './store.js';
import { requireActor } from './auth.js';
import { corsDelegate, hasConfiguredOrigins } from './cors.js';
import {
  PHOTO_FOLDERS,
  buildSignedUpload,
  destroyAsset,
  isCloudinaryConfigured,
  isOwnCloudinaryUrl,
} from './cloudinary.js';
import {
  IMPORT_COLLECTIONS,
  IMPORT_COLLECTION_KEYS,
  mergeImport,
  normalizeImportedData,
  validateImportedData,
} from './import-validation.js';
import {
  attendanceModeOf,
  isSessionTypeAllowed,
  parseAttendanceMode,
  primarySessionType,
  sessionTypeLabel,
  sessionTypesFor,
} from './attendance-mode.js';
import {
  dayName,
  getTimetableConfig,
  isDateString,
  timeRangesOverlap,
  validatePeriods,
} from './timetable.js';

const __dirname = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return '/';
  }
})();
const ROOT = path.resolve(__dirname, '../..');
const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(cors(corsDelegate));
app.use(express.json({ limit: '8mb' }));

const ADMIN_LEVELS = new Set(['SuperAdmin', 'SubAdmin']);
const ATTENDANCE_STATUSES = new Set(['present', 'absent', 'late', 'excused']);
const RMS_STATUSES = new Set(['pending', 'underReview', 'approved', 'rejected', 'resolved']);
const RMS_CATEGORIES = new Set([
  'leave',
  'maintenance',
  'gear',
  'confidential',
  'general',
]);
const IMPORTANCE = new Set(['Normal', 'Important', 'Urgent', 'Emergency']);
const ATTENDANCE_TYPES = new Set(['Morning', 'Afternoon', 'FullDay']);
const EXAM_CATEGORIES = new Set(['classTest', 'ca1', 'ca2', 'midTerm', 'endTerm']);

const ACCOUNTS = new Map(
  [
    { email: 'admin@nawazschool.edu', password: 'admin123', staffId: 'STF-001' },
    { email: 'subadmin@nawazschool.edu', password: 'subadmin123', staffId: 'STF-007' },
    { email: 'teacher@nawazschool.edu', password: 'teacher123', staffId: 'STF-002' },
    { email: 'imran@nawazschool.edu', password: 'teacher123', staffId: 'STF-003' },
    { email: 'ayesha@nawazschool.edu', password: 'teacher123', staffId: 'STF-004' },
    { email: 'bilal@nawazschool.edu', password: 'teacher123', staffId: 'STF-005' },
  ].map((account) => [account.email, account])
);

function str(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isAdmin(staff) {
  return Boolean(staff && ADMIN_LEVELS.has(staff.accessLevel));
}

function isSuperAdmin(staff) {
  return Boolean(staff && staff.accessLevel === 'SuperAdmin');
}

function isoNow() {
  return new Date().toISOString();
}

function addActivity(db, actor, action, entity, entityId, detail) {
  db.activities.unshift({
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
    actorId: actor?.id || 'SYSTEM',
    actorName: actor?.name || 'System',
    action,
    entity,
    entityId,
    detail,
    createdAt: isoNow(),
  });
  db.activities = db.activities.slice(0, 150);
}

function teacherClassIds(db, staffId) {
  const ids = new Set();
  db.subjects
    .filter((subject) => subject.assignedStaffId === staffId)
    .forEach((subject) => ids.add(subject.classIdSection));
  db.timetable
    .filter((period) => period.teacherStaffId === staffId)
    .forEach((period) => ids.add(period.classIdSection));
  db.classIncharges
    .filter((incharge) => incharge.activeStaffId === staffId)
    .forEach((incharge) => ids.add(incharge.classIdSection));
  return [...ids];
}

function classifyRms(text) {
  const lower = String(text || '').toLowerCase();
  if (/(confidential|private|personal|harassment|complaint)/.test(lower)) return 'confidential';
  if (/(leave|sick|absent|medical|emergency|casual)/.test(lower)) return 'leave';
  if (/(broken|repair|projector|ac\b|fan|light|bench|wi-?fi|bulb|desk|exhaust)/.test(lower))
    return 'maintenance';
  if (/(gear|equipment|kit|lab|supplies|material)/.test(lower)) return 'gear';
  return 'general';
}

function attendanceDateTime(date, time) {
  return new Date(`${date}T${time || '23:59'}:00`);
}

function effectiveExamStatus(exam) {
  if (['Submitted', 'Locked'].includes(exam.marksStatus)) return exam.marksStatus;
  const endsAt = attendanceDateTime(exam.date, exam.endTime);
  return new Date() > endsAt ? 'Open' : 'Upcoming';
}

function nextStudentCode(db, classIdSection, rollNumber) {
  return `STU-${classIdSection.replace('-', '')}-${rollNumber}`;
}

function nextRollNumber(db, classIdSection) {
  const rolls = db.students
    .filter((student) => student.classIdSection === classIdSection)
    .map((student) => Number.parseInt(student.rollNumber, 10))
    .filter((number) => Number.isFinite(number));
  return String((rolls.length ? Math.max(...rolls) : 0) + 1).padStart(2, '0');
}

function nextStaffCode(db) {
  const numbers = db.staff
    .map((member) => Number.parseInt(String(member.code || member.id).replace(/\D/g, ''), 10))
    .filter((number) => Number.isFinite(number));
  return `STF-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}`;
}

function nextTicketNumber(db) {
  const numbers = db.rmsTickets
    .map((ticket) => Number.parseInt(String(ticket.ticketNo).replace(/\D/g, ''), 10))
    .filter((number) => Number.isFinite(number));
  return `RMS-2026-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}`;
}

function nextAnnouncementId(db) {
  const numbers = db.announcements
    .map((announcement) => Number.parseInt(String(announcement.id).replace(/\D/g, ''), 10))
    .filter((number) => Number.isFinite(number));
  return `ANN-${String((numbers.length ? Math.max(...numbers) : 0) + 1).padStart(3, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Auth                                                               */
/* ------------------------------------------------------------------ */

app.get('/api/health', (req, res) => {
  const db = getDb();
  res.json({
    ok: true,
    school: db.meta.schoolName,
    revision: db.meta.revision,
    updatedAt: db.meta.updatedAt,
    mode: getBackendName(),
  });
});

app.post('/api/auth/login', (req, res) => {
  const db = getDb();
  const email = str(req.body?.email).toLowerCase();
  const password = str(req.body?.password);
  const account = ACCOUNTS.get(email);

  if (!account || account.password !== password) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  const staff = db.staff.find((member) => member.id === account.staffId);
  if (!staff) {
    return res.status(401).json({ error: 'This account no longer exists.' });
  }
  if (!staff.isActive) {
    return res.status(403).json({ error: 'This account is inactive. Contact the school office.' });
  }
  if (staff.accessLevel === 'NoAccess') {
    return res.status(403).json({ error: 'This account does not have software access.' });
  }

  return res.json({
    user: staff,
    permissions: {
      admin: isAdmin(staff),
      superAdmin: isSuperAdmin(staff),
      teacher: true,
      teacherClassIds: teacherClassIds(db, staff.id),
    },
  });
});

function requireAdmin(req, res, next) {
  if (!isAdmin(req.actor)) {
    return res.status(403).json({ error: 'Administrator access is required.' });
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!isSuperAdmin(req.actor)) {
    return res.status(403).json({ error: 'Only a SuperAdmin can perform this action.' });
  }
  return next();
}

app.get('/api/state', requireActor, (req, res) => {
  const db = getDb();
  res.json({
    ...db,
    now: isoNow(),
    me: req.actor,
    permissions: {
      admin: isAdmin(req.actor),
      superAdmin: isSuperAdmin(req.actor),
      teacherClassIds: teacherClassIds(db, req.actor.id),
    },
  });
});

app.get('/api/events', requireActor, (req, res) => {
  const db = getDb();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`event: ready\ndata: ${JSON.stringify({ revision: db.meta.revision })}\n\n`);

  const onStoreChange = (payload) => {
    res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  storeEvents.on('change', onStoreChange);
  const heartbeat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    storeEvents.off('change', onStoreChange);
    res.end();
  });
  return undefined;
});

/* ------------------------------------------------------------------ */
/* Students                                                           */
/* ------------------------------------------------------------------ */

app.post('/api/students', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const classIdSection = str(body.classIdSection);
  const classRecord = db.classes.find((cls) => cls.id === classIdSection);
  if (!classRecord) return res.status(400).json({ error: 'Select a valid class and section.' });

  const name = str(body.name);
  if (!name) return res.status(400).json({ error: 'Student name is required.' });

  const rollNumber = str(body.rollNumber) || nextRollNumber(db, classIdSection);
  const duplicateRoll = db.students.find(
    (student) =>
      student.classIdSection === classIdSection &&
      student.rollNumber === rollNumber
  );
  if (duplicateRoll) {
    return res.status(409).json({ error: `Roll ${rollNumber} is already used in ${classIdSection}.` });
  }

  let code = str(body.code || body.studentCode) || nextStudentCode(db, classIdSection, rollNumber);
  if (db.students.some((student) => student.code === code || student.id === code)) {
    return res.status(409).json({ error: `Student code ${code} already exists.` });
  }

  const student = {
    id: code,
    code,
    rollNumber,
    name,
    classIdSection,
    guardianName: str(body.guardianName),
    parentPhone: str(body.parentPhone),
    gender: str(body.gender) || 'Not specified',
    dateOfBirth: str(body.dateOfBirth),
    address: str(body.address),
    admissionDate: str(body.admissionDate) || new Date().toISOString().slice(0, 10),
    status: str(body.status) || 'Active',
    createdAt: isoNow(),
  };

  mutate((current) => {
    current.students.push(student);
    addActivity(current, req.actor, 'Added student', 'Student', student.code, student.name);
  });

  return res.status(201).json({ student });
});

app.patch('/api/students/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const student = db.students.find((entry) => entry.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found.' });

  const body = req.body || {};
  const nextClass = body.classIdSection !== undefined ? str(body.classIdSection) : student.classIdSection;
  if (!db.classes.some((cls) => cls.id === nextClass)) {
    return res.status(400).json({ error: 'Select a valid class and section.' });
  }
  const nextRoll =
    body.rollNumber !== undefined ? str(body.rollNumber) : student.rollNumber;
  if (!nextRoll) return res.status(400).json({ error: 'Roll number is required.' });
  const duplicateRoll = db.students.find(
    (entry) =>
      entry.id !== student.id &&
      entry.classIdSection === nextClass &&
      entry.rollNumber === nextRoll
  );
  if (duplicateRoll) {
    return res.status(409).json({ error: `Roll ${nextRoll} is already used in ${nextClass}.` });
  }

  const allowed = [
    'name',
    'rollNumber',
    'classIdSection',
    'guardianName',
    'parentPhone',
    'gender',
    'dateOfBirth',
    'address',
    'status',
  ];
  mutate((current) => {
    const target = current.students.find((entry) => entry.id === student.id);
    allowed.forEach((field) => {
      if (body[field] !== undefined) target[field] = body[field];
    });
    target.name = str(target.name) || student.name;
    target.rollNumber = nextRoll;
    target.classIdSection = nextClass;
    addActivity(current, req.actor, 'Updated student record', 'Student', target.code, target.name);
  });

  return res.json({ student: getDb().students.find((entry) => entry.id === student.id) });
});

app.delete('/api/students/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const student = db.students.find((entry) => entry.id === req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found.' });

  mutate((current) => {
    current.students = current.students.filter((entry) => entry.id !== student.id);
    current.testRecords = current.testRecords.filter(
      (record) => record.studentId !== student.id
    );
    current.attendanceSessions.forEach((session) => {
      session.entries = session.entries.filter((entry) => entry.studentId !== student.id);
    });
    addActivity(
      current,
      req.actor,
      'Deleted student record',
      'Student',
      student.code,
      student.name
    );
  });

  discardPhoto(student.photo, 'student deleted');

  return res.json({ ok: true });
});

app.post('/api/students/bulk', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No rows were provided.' });

  let inserted = 0;
  let updated = 0;
  const errors = [];

  mutate((current) => {
    rows.forEach((raw, index) => {
      const rowNumber = index + 2;
      const name = str(raw.name);
      const classIdSection = str(raw.class_id_section || raw.classIdSection || raw.class);
      const code = str(raw.student_id || raw.code || raw.studentCode);
      if (!name) {
        errors.push({ row: rowNumber, message: 'Name is required.' });
        return;
      }
      if (!current.classes.some((cls) => cls.id === classIdSection)) {
        errors.push({ row: rowNumber, message: `Unknown class "${classIdSection}".` });
        return;
      }
      const existing = code
        ? current.students.find(
            (student) => student.code === code || student.id === code
          )
        : current.students.find(
            (student) =>
              student.name.toLowerCase() === name.toLowerCase() &&
              student.classIdSection === classIdSection
          );
      const roll = str(raw.roll_number || raw.rollNumber) || (existing ? existing.rollNumber : nextRollNumber(current, classIdSection));
      const duplicateRoll = current.students.find(
        (student) =>
          student.id !== existing?.id &&
          student.classIdSection === classIdSection &&
          student.rollNumber === roll
      );
      if (duplicateRoll) {
        errors.push({
          row: rowNumber,
          message: `Roll ${roll} is already used by ${duplicateRoll.name}.`,
        });
        return;
      }

      if (existing) {
        existing.name = name;
        existing.rollNumber = roll;
        existing.classIdSection = classIdSection;
        existing.parentPhone = str(raw.parent_phone || raw.parentPhone) || existing.parentPhone;
        existing.guardianName = str(raw.guardian_name || raw.guardianName) || existing.guardianName;
        updated += 1;
      } else {
        const finalCode = code || nextStudentCode(current, classIdSection, roll);
        if (current.students.some((student) => student.code === finalCode)) {
          errors.push({ row: rowNumber, message: `Student code ${finalCode} already exists.` });
          return;
        }
        current.students.push({
          id: finalCode,
          code: finalCode,
          rollNumber: roll,
          name,
          classIdSection,
          guardianName: str(raw.guardian_name || raw.guardianName),
          parentPhone: str(raw.parent_phone || raw.parentPhone),
          gender: str(raw.gender) || 'Not specified',
          dateOfBirth: str(raw.date_of_birth || raw.dateOfBirth),
          address: str(raw.address),
          admissionDate: isoNow().slice(0, 10),
          status: 'Active',
          createdAt: isoNow(),
        });
        inserted += 1;
      }
    });
    addActivity(
      current,
      req.actor,
      'Imported student roster',
      'Student',
      'bulk',
      `${inserted} added, ${updated} updated, ${errors.length} row errors`
    );
  });

  return res.json({ inserted, updated, errors, total: rows.length });
});

/* ------------------------------------------------------------------ */
/* Staff and RBAC                                                     */
/* ------------------------------------------------------------------ */

app.post('/api/staff', requireActor, requireSuperAdmin, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const name = str(body.name);
  const email = str(body.email).toLowerCase();
  if (!name) return res.status(400).json({ error: 'Staff name is required.' });
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (db.staff.some((member) => member.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'That email address is already in use.' });
  }

  const code = nextStaffCode(db);
  const member = {
    id: code,
    code,
    name,
    email,
    phone: str(body.phone),
    staffType: str(body.staffType) || 'Teacher',
    department: str(body.department) || 'General',
    accessLevel: str(body.accessLevel) || 'TeacherApp',
    isActive: body.isActive !== false,
    joinedOn: str(body.joinedOn) || isoNow().slice(0, 10),
    avatarColor: ['#4338CA', '#0D9488', '#1D4ED8', '#B45309', '#7C3AED', '#BE185D'][
      db.staff.length % 6
    ],
  };

  mutate((current) => {
    current.staff.push(member);
    addActivity(current, req.actor, 'Added staff member', 'Staff', member.code, member.name);
  });

  return res.status(201).json({ staff: member });
});

app.patch('/api/staff/:id', requireActor, requireSuperAdmin, (req, res) => {
  const db = getDb();
  const member = db.staff.find((entry) => entry.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Staff member not found.' });

  const body = req.body || {};
  if (member.id === req.actor.id && body.isActive === false) {
    return res.status(400).json({ error: 'You cannot deactivate your own account.' });
  }
  if (member.id === req.actor.id && body.accessLevel && body.accessLevel !== 'SuperAdmin') {
    return res.status(400).json({ error: 'You cannot remove your own SuperAdmin access.' });
  }
  if (body.email) {
    const email = str(body.email).toLowerCase();
    if (!email.includes('@')) return res.status(400).json({ error: 'Enter a valid email.' });
    if (
      db.staff.some(
        (entry) => entry.id !== member.id && entry.email.toLowerCase() === email
      )
    ) {
      return res.status(409).json({ error: 'That email address is already in use.' });
    }
  }
  const superAdmins = db.staff.filter(
    (entry) => entry.accessLevel === 'SuperAdmin' && entry.isActive
  );
  if (
    member.accessLevel === 'SuperAdmin' &&
    superAdmins.length <= 1 &&
    (body.accessLevel && body.accessLevel !== 'SuperAdmin')
  ) {
    return res.status(400).json({ error: 'At least one active SuperAdmin is required.' });
  }

  const allowed = [
    'name',
    'email',
    'phone',
    'staffType',
    'department',
    'accessLevel',
    'isActive',
    'joinedOn',
  ];
  mutate((current) => {
    const target = current.staff.find((entry) => entry.id === member.id);
    allowed.forEach((field) => {
      if (body[field] !== undefined) target[field] = body[field];
    });
    if (target.email) target.email = str(target.email).toLowerCase();
    addActivity(
      current,
      req.actor,
      'Updated staff access',
      'Staff',
      target.code,
      `${target.name} · ${target.accessLevel}${target.isActive ? '' : ' · inactive'}`
    );
  });

  return res.json({ staff: getDb().staff.find((entry) => entry.id === member.id) });
});

app.delete('/api/staff/:id', requireActor, requireSuperAdmin, (req, res) => {
  const db = getDb();
  const member = db.staff.find((entry) => entry.id === req.params.id);
  if (!member) return res.status(404).json({ error: 'Staff member not found.' });
  if (member.id === req.actor.id) {
    return res.status(400).json({ error: 'You cannot delete your own account.' });
  }
  const referencedByTimetable = db.timetable.some(
    (period) => period.teacherStaffId === member.id
  );
  const referencedBySubject = db.subjects.some(
    (subject) => subject.assignedStaffId === member.id
  );
  if (referencedByTimetable || referencedBySubject) {
    return res.status(409).json({
      error: 'This staff member is referenced by the timetable or subject assignments. Deactivate the account instead.',
    });
  }

  mutate((current) => {
    current.staff = current.staff.filter((entry) => entry.id !== member.id);
    addActivity(current, req.actor, 'Removed staff member', 'Staff', member.code, member.name);
  });

  discardPhoto(member.photo, 'staff deleted');

  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Attendance                                                         */
/* ------------------------------------------------------------------ */

app.post('/api/attendance', requireActor, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const classIdSection = str(body.classIdSection);
  const date = str(body.date);
  const sessionType = str(body.sessionType) || 'Morning';
  const periodNumber =
    body.periodNumber === null || body.periodNumber === undefined || body.periodNumber === ''
      ? null
      : Number(body.periodNumber);

  if (!db.classes.some((cls) => cls.id === classIdSection)) {
    return res.status(400).json({ error: 'Select a valid class and section.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Select a valid date.' });
  }
  if (!ATTENDANCE_TYPES.has(sessionType)) {
    return res.status(400).json({ error: 'Select a valid session.' });
  }

  const mode = attendanceModeOf(db.meta);
  if (!isSessionTypeAllowed(mode, sessionType)) {
    return res.status(400).json({
      error:
        mode === 'fullDay'
          ? 'This school records one attendance register per day. Submit the full-day register instead.'
          : 'This school records morning and afternoon registers. Choose Morning or Afternoon.',
    });
  }
  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return res.status(400).json({ error: 'Attendance must include at least one student.' });
  }

  const incharge = db.classIncharges.find(
    (entry) =>
      entry.classIdSection === classIdSection && entry.activeStaffId === req.actor.id
  );
  if (!isAdmin(req.actor) && !incharge) {
    return res.status(403).json({
      error: 'Only the class attendance incharge can submit this roll-call.',
    });
  }

  const roster = new Set(
    db.students
      .filter((student) => student.classIdSection === classIdSection)
      .map((student) => student.id)
  );
  const cleanEntries = [];
  for (const entry of body.entries) {
    const studentId = str(entry.studentId);
    const status = str(entry.status).toLowerCase();
    if (!roster.has(studentId)) {
      return res.status(400).json({ error: `Student ${studentId} is not in ${classIdSection}.` });
    }
    if (!ATTENDANCE_STATUSES.has(status)) {
      return res.status(400).json({ error: `Invalid attendance status "${entry.status}".` });
    }
    cleanEntries.push({
      studentId,
      status,
      remarks: str(entry.remarks),
    });
  }

  const sessionId = `ATT-${classIdSection}-${date}-${sessionType}${
    periodNumber ? `-P${periodNumber}` : ''
  }`;
  let saved;

  mutate((current) => {
    const existing = current.attendanceSessions.find(
      (session) => session.id === sessionId
    );
    if (existing) {
      existing.entries = cleanEntries;
      existing.updatedAt = isoNow();
      existing.updatedByStaffId = req.actor.id;
      existing.periodNumber = periodNumber;
      saved = existing;
    } else {
      saved = {
        id: sessionId,
        classIdSection,
        date,
        dayOfWeek: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
          weekday: 'long',
        }),
        sessionType,
        periodNumber,
        submittedByStaffId: req.actor.id,
        submittedAt: isoNow(),
        entries: cleanEntries,
      };
      current.attendanceSessions.push(saved);
    }
    addActivity(
      current,
      req.actor,
      'Attendance submitted',
      'Attendance',
      classIdSection,
      `${classIdSection} · ${date} · ${sessionType} · ${cleanEntries.filter((entry) => entry.status === 'present').length}/${cleanEntries.length} present`
    );
  });

  return res.json({ attendance: saved });
});

/* ------------------------------------------------------------------ */
/* Timetable                                                          */
/* ------------------------------------------------------------------ */

function timetableEditError(db) {
  const config = getTimetableConfig(db);
  if (config.status === 'published') {
    return 'The timetable is published. Reopen editing before changing any slot.';
  }
  if (!config.windowOpen) {
    return `Timetable editing closed on ${config.editUntil}. Extend the editing window before changing any slot.`;
  }
  return null;
}

app.put('/api/timetable', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const editError = timetableEditError(db);
  if (editError) return res.status(409).json({ error: editError });

  const body = req.body || {};
  const config = getTimetableConfig(db);
  const classIdSection = str(body.classIdSection);
  const dayOfWeek = Number(body.dayOfWeek);
  const periodNumber = Number(body.periodNumber);
  const subjectId = str(body.subjectId);
  const requestedTeacherId = str(body.teacherStaffId);

  const cls = db.classes.find((entry) => entry.id === classIdSection);
  if (!cls) return res.status(400).json({ error: 'Select a valid class.' });
  if (!config.days.includes(dayOfWeek)) {
    return res.status(400).json({ error: 'That day is not part of the school week.' });
  }
  const period = config.periods.find((entry) => entry.periodNumber === periodNumber);
  if (!period) return res.status(400).json({ error: 'Select a valid period.' });
  const subject = db.subjects.find(
    (entry) => entry.id === subjectId && entry.classIdSection === classIdSection
  );
  if (!subject) {
    return res.status(400).json({ error: 'Select a subject offered by this class.' });
  }
  const teacherId = requestedTeacherId || subject.assignedStaffId;
  const teacher = db.staff.find(
    (member) => member.id === teacherId && member.isActive
  );
  if (!teacher) {
    return res.status(400).json({ error: 'Select an active teacher for this period.' });
  }

  const existing = db.timetable.find(
    (entry) =>
      entry.classIdSection === classIdSection &&
      entry.dayOfWeek === dayOfWeek &&
      entry.periodNumber === periodNumber
  );

  const conflict = db.timetable.find((entry) => {
    if (existing && entry.id === existing.id) return false;
    if (entry.dayOfWeek !== dayOfWeek) return false;
    if (!timeRangesOverlap(period.startTime, period.endTime, entry.startTime, entry.endTime)) {
      return false;
    }
    return entry.teacherStaffId === teacher.id || entry.classIdSection === classIdSection;
  });
  if (conflict) {
    if (conflict.teacherStaffId === teacher.id) {
      return res.status(409).json({
        error: `${teacher.name} is already teaching ${conflict.subject} for ${conflict.classIdSection} at that time.`,
      });
    }
    return res.status(409).json({
      error: `${classIdSection} already has ${conflict.subject} at that time.`,
    });
  }

  const entry = {
    id: existing?.id || `TT-${classIdSection}-D${dayOfWeek}-P${periodNumber}`,
    classIdSection,
    className: cls.displayName,
    subjectId: subject.id,
    subjectCode: subject.subjectCode,
    subject: subject.subjectName,
    teacherStaffId: teacher.id,
    teacherName: teacher.name,
    dayOfWeek,
    dayName: dayName(dayOfWeek),
    periodNumber,
    startTime: period.startTime,
    endTime: period.endTime,
    room:
      str(body.room) ||
      (subject.isLab
        ? `Lab ${cls.section === 'A' ? 'Alpha' : 'Beta'}`
        : cls.room),
    isLab: Boolean(subject.isLab),
  };

  mutate((current) => {
    const index = current.timetable.findIndex((row) => row.id === entry.id);
    if (index >= 0) current.timetable[index] = entry;
    else current.timetable.push(entry);
    addActivity(
      current,
      req.actor,
      existing ? 'Updated timetable slot' : 'Added timetable slot',
      'Timetable',
      entry.id,
      `${entry.classIdSection} · ${entry.dayName} P${entry.periodNumber} · ${entry.subject}`
    );
  });

  return res.json({ entry, config: getTimetableConfig(getDb()) });
});

app.delete('/api/timetable/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const editError = timetableEditError(db);
  if (editError) return res.status(409).json({ error: editError });

  const entry = db.timetable.find((row) => row.id === req.params.id);
  if (!entry) return res.status(404).json({ error: 'Timetable slot not found.' });

  mutate((current) => {
    current.timetable = current.timetable.filter((row) => row.id !== entry.id);
    addActivity(
      current,
      req.actor,
      'Removed timetable slot',
      'Timetable',
      entry.id,
      `${entry.classIdSection} · ${entry.dayName} P${entry.periodNumber}`
    );
  });

  return res.json({ ok: true, config: getTimetableConfig(getDb()) });
});

app.patch('/api/timetable/settings', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const current = getTimetableConfig(db);

  let days = current.days;
  if (body.days !== undefined) {
    if (!Array.isArray(body.days)) {
      return res.status(400).json({ error: 'Working days must be an array.' });
    }
    days = [
      ...new Set(
        body.days
          .map(Number)
          .filter((day) => Number.isInteger(day) && day >= 1 && day <= 6)
      ),
    ].sort((a, b) => a - b);
    if (!days.length) {
      return res.status(400).json({ error: 'Choose at least one working day (Monday–Saturday).' });
    }
    if (days.length !== body.days.length) {
      return res.status(400).json({ error: 'Working days must be unique values from 1 to 6.' });
    }
  }

  let periods = current.periods;
  if (body.periods !== undefined) {
    const result = validatePeriods(body.periods);
    if (result.error) return res.status(400).json({ error: result.error });
    periods = result.periods;
  }

  const status =
    body.status === 'published'
      ? 'published'
      : body.status === 'draft'
        ? 'draft'
        : current.status;
  const editUntil =
    body.editUntil !== undefined ? str(body.editUntil) : current.editUntil;
  if (!isDateString(editUntil)) {
    return res.status(400).json({ error: 'Editing deadline must use YYYY-MM-DD.' });
  }

  const scheduleChanged =
    JSON.stringify(days) !== JSON.stringify(current.days) ||
    JSON.stringify(periods) !== JSON.stringify(current.periods);
  if (current.status === 'published' && scheduleChanged && status !== 'draft') {
    return res.status(409).json({
      error: 'Reopen timetable editing before changing working days or period times.',
    });
  }

  let removed = 0;
  mutate((store) => {
    const periodMap = new Map(periods.map((period) => [period.periodNumber, period]));
    const kept = store.timetable.filter(
      (entry) => days.includes(entry.dayOfWeek) && periodMap.has(entry.periodNumber)
    );
    removed = store.timetable.length - kept.length;
    kept.forEach((entry) => {
      const period = periodMap.get(entry.periodNumber);
      entry.startTime = period.startTime;
      entry.endTime = period.endTime;
      entry.dayName = dayName(entry.dayOfWeek);
    });
    store.timetable = kept;

    store.meta.timetableDays = days;
    store.meta.timetablePeriods = periods;
    store.meta.timetableStatus = status;
    store.meta.timetableEditUntil = editUntil;
    if (status === 'published') {
      store.meta.timetablePublishedAt =
        store.meta.timetablePublishedAt || isoNow();
    } else {
      store.meta.timetablePublishedAt = null;
    }

    addActivity(
      store,
      req.actor,
      status === 'published' ? 'Published timetable' : 'Updated timetable settings',
      'Timetable',
      'timetable-settings',
      `${days.length} days · ${periods.length} periods · editing until ${editUntil}${removed ? ` · ${removed} slot(s) removed` : ''}`
    );
  });

  return res.json({
    config: getTimetableConfig(getDb()),
    removed,
  });
});

/* ------------------------------------------------------------------ */
/* Exams and marks                                                    */
/* ------------------------------------------------------------------ */

app.post('/api/exams', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const classIdSection = str(body.classIdSection);
  const subjectId = str(body.subjectId);
  const title = str(body.title);
  const date = str(body.date);
  const category = str(body.category) || 'ca1';
  const maxMarks = Number(body.maxMarks);

  const subject = db.subjects.find(
    (entry) => entry.id === subjectId && entry.classIdSection === classIdSection
  );
  if (!subject) return res.status(400).json({ error: 'Select a subject for the selected class.' });
  if (!title) return res.status(400).json({ error: 'Exam title is required.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Select a valid exam date.' });
  }
  if (!EXAM_CATEGORIES.has(category)) {
    return res.status(400).json({ error: 'Select a valid assessment category.' });
  }
  if (!Number.isFinite(maxMarks) || maxMarks <= 0) {
    return res.status(400).json({ error: 'Maximum marks must be greater than zero.' });
  }

  const exam = {
    id: `EXM-${Date.now().toString().slice(-6)}`,
    title,
    classIdSection,
    subjectId,
    subject: subject.subjectName,
    category,
    date,
    startTime: str(body.startTime) || '09:00',
    endTime: str(body.endTime) || '11:00',
    maxMarks,
    assignedStaffId: str(body.assignedStaffId) || subject.assignedStaffId,
    marksStatus: 'Upcoming',
    createdAt: isoNow(),
    submittedAt: null,
  };

  mutate((current) => {
    current.exams.push(exam);
    addActivity(
      current,
      req.actor,
      'Scheduled assessment',
      'Exam',
      exam.id,
      `${exam.title} · ${exam.classIdSection}`
    );
  });

  return res.status(201).json({ exam });
});

app.patch('/api/exams/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const exam = db.exams.find((entry) => entry.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });
  const body = req.body || {};
  const allowed = ['title', 'date', 'startTime', 'endTime', 'maxMarks', 'assignedStaffId', 'marksStatus'];
  mutate((current) => {
    const target = current.exams.find((entry) => entry.id === exam.id);
    allowed.forEach((field) => {
      if (body[field] !== undefined) target[field] = body[field];
    });
    addActivity(current, req.actor, 'Updated assessment', 'Exam', target.id, target.title);
  });
  return res.json({ exam: getDb().exams.find((entry) => entry.id === exam.id) });
});

app.delete('/api/exams/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const exam = db.exams.find((entry) => entry.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });
  mutate((current) => {
    current.exams = current.exams.filter((entry) => entry.id !== exam.id);
    current.testRecords = current.testRecords.filter(
      (record) => record.examId !== exam.id
    );
    addActivity(current, req.actor, 'Deleted assessment', 'Exam', exam.id, exam.title);
  });
  return res.json({ ok: true });
});

app.post('/api/exams/:id/marks', requireActor, (req, res) => {
  const db = getDb();
  const exam = db.exams.find((entry) => entry.id === req.params.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found.' });
  if (!isAdmin(req.actor) && exam.assignedStaffId !== req.actor.id) {
    return res.status(403).json({ error: 'This assessment is assigned to another teacher.' });
  }
  if (!isAdmin(req.actor) && exam.marksStatus === 'Submitted') {
    return res.status(409).json({
      error: 'Marks have already been submitted. Ask an administrator to make a correction.',
    });
  }
  if (!isAdmin(req.actor) && effectiveExamStatus(exam) !== 'Open') {
    return res.status(409).json({ error: 'Marks entry opens after the exam has concluded.' });
  }

  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!records.length) return res.status(400).json({ error: 'No student scores were provided.' });
  const roster = new Set(
    db.students
      .filter((student) => student.classIdSection === exam.classIdSection)
      .map((student) => student.id)
  );
  const clean = [];
  for (const record of records) {
    const studentId = str(record.studentId);
    const marks = Number(record.marksObtained);
    if (!roster.has(studentId)) {
      return res.status(400).json({ error: `Student ${studentId} is not in ${exam.classIdSection}.` });
    }
    if (!Number.isFinite(marks) || marks < 0 || marks > exam.maxMarks) {
      return res.status(400).json({
        error: `Marks must be between 0 and ${exam.maxMarks}.`,
      });
    }
    clean.push({ studentId, marks });
  }

  let savedRecords = [];
  mutate((current) => {
    const target = current.exams.find((entry) => entry.id === exam.id);
    const studentsById = new Map(current.students.map((student) => [student.id, student]));
    clean.forEach(({ studentId, marks }) => {
      const existing = current.testRecords.find(
        (record) => record.examId === exam.id && record.studentId === studentId
      );
      const student = studentsById.get(studentId);
      const payload = {
        examId: exam.id,
        examTitle: exam.title,
        studentId,
        studentName: student?.name || '',
        classIdSection: exam.classIdSection,
        subject: exam.subject,
        category: exam.category,
        marksObtained: marks,
        maxMarks: exam.maxMarks,
        percentage: Math.round((marks / exam.maxMarks) * 1000) / 10,
        enteredByStaffId: req.actor.id,
        enteredAt: isoNow(),
      };
      if (existing) {
        Object.assign(existing, payload);
        savedRecords.push(existing);
      } else {
        const record = {
          id: `TR-${exam.id}-${studentId}`,
          ...payload,
        };
        current.testRecords.push(record);
        savedRecords.push(record);
      }
    });
    target.marksStatus = 'Submitted';
    target.submittedAt = isoNow();
    addActivity(
      current,
      req.actor,
      'Submitted assessment marks',
      'Exam',
      exam.id,
      `${exam.title} · ${exam.classIdSection} · ${clean.length} students`
    );
  });

  return res.json({
    exam: getDb().exams.find((entry) => entry.id === exam.id),
    records: savedRecords,
  });
});

/* ------------------------------------------------------------------ */
/* Subjects and syllabus                                              */
/* ------------------------------------------------------------------ */

app.patch('/api/subjects/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const subject = db.subjects.find((entry) => entry.id === req.params.id);
  if (!subject) return res.status(404).json({ error: 'Subject assignment not found.' });
  const staffId = str(req.body?.assignedStaffId);
  const teacher = db.staff.find((member) => member.id === staffId);
  if (!teacher) return res.status(400).json({ error: 'Select a valid teacher.' });

  mutate((current) => {
    const target = current.subjects.find((entry) => entry.id === subject.id);
    target.assignedStaffId = teacher.id;
    target.assignedTeacherName = teacher.name;
    target.updatedAt = isoNow();
    current.timetable.forEach((period) => {
      if (period.subjectId === subject.id) {
        period.teacherStaffId = teacher.id;
        period.teacherName = teacher.name;
      }
    });
    addActivity(
      current,
      req.actor,
      'Assigned subject teacher',
      'Subject',
      subject.id,
      `${subject.subjectName} · ${subject.classIdSection} → ${teacher.name}`
    );
  });

  return res.json({ subject: getDb().subjects.find((entry) => entry.id === subject.id) });
});

app.post('/api/subjects/:id/chapters', requireActor, (req, res) => {
  const db = getDb();
  const subject = db.subjects.find((entry) => entry.id === req.params.id);
  if (!subject) return res.status(404).json({ error: 'Subject not found.' });
  if (!isAdmin(req.actor) && subject.assignedStaffId !== req.actor.id) {
    return res.status(403).json({ error: 'This subject is assigned to another teacher.' });
  }
  const chapterIndex = Number(req.body?.chapterIndex);
  const status = str(req.body?.status);
  if (
    !Number.isInteger(chapterIndex) ||
    chapterIndex < 0 ||
    chapterIndex >= subject.chapters.length
  ) {
    return res.status(400).json({ error: 'Select a valid chapter.' });
  }
  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return res.status(400).json({ error: 'Select a valid chapter status.' });
  }

  mutate((current) => {
    const target = current.subjects.find((entry) => entry.id === subject.id);
    target.chapters[chapterIndex].status = status;
    target.updatedAt = isoNow();
    addActivity(
      current,
      req.actor,
      'Updated syllabus progress',
      'Syllabus',
      subject.id,
      `${subject.subjectName} · ${target.chapters[chapterIndex].title} → ${status.replace('_', ' ')}`
    );
  });

  return res.json({ subject: getDb().subjects.find((entry) => entry.id === subject.id) });
});

/* ------------------------------------------------------------------ */
/* Assignments                                                        */
/* ------------------------------------------------------------------ */

app.post('/api/assignments', requireActor, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const classIdSection = str(body.classIdSection);
  const title = str(body.title);
  const dueDate = str(body.dueDate);
  if (!title) return res.status(400).json({ error: 'Assignment title is required.' });
  if (!db.classes.some((cls) => cls.id === classIdSection)) {
    return res.status(400).json({ error: 'Select a valid class.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
    return res.status(400).json({ error: 'Select a valid due date.' });
  }
  if (!isAdmin(req.actor) && !teacherClassIds(db, req.actor.id).includes(classIdSection)) {
    return res.status(403).json({ error: 'You can only create assignments for your own classes.' });
  }

  const assignment = {
    id: `ASG-${Date.now().toString().slice(-6)}`,
    title,
    description: str(body.description),
    classIdSection,
    subject: str(body.subject) || 'General',
    dueDate,
    status: str(body.status) || 'Assigned',
    createdByStaffId: req.actor.id,
    createdAt: isoNow(),
  };
  mutate((current) => {
    current.assignments.push(assignment);
    addActivity(
      current,
      req.actor,
      'Created assignment',
      'Assignment',
      assignment.id,
      `${assignment.title} · ${assignment.classIdSection}`
    );
  });
  return res.status(201).json({ assignment });
});

app.patch('/api/assignments/:id', requireActor, (req, res) => {
  const db = getDb();
  const assignment = db.assignments.find((entry) => entry.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  if (!isAdmin(req.actor) && assignment.createdByStaffId !== req.actor.id) {
    return res.status(403).json({ error: 'Only the creator can update this assignment.' });
  }
  const body = req.body || {};
  const allowed = ['title', 'description', 'dueDate', 'status', 'subject'];
  mutate((current) => {
    const target = current.assignments.find((entry) => entry.id === assignment.id);
    allowed.forEach((field) => {
      if (body[field] !== undefined) target[field] = str(body[field]);
    });
    addActivity(
      current,
      req.actor,
      'Updated assignment',
      'Assignment',
      target.id,
      `${target.title} → ${target.status}`
    );
  });
  return res.json({ assignment: getDb().assignments.find((entry) => entry.id === assignment.id) });
});

app.delete('/api/assignments/:id', requireActor, (req, res) => {
  const db = getDb();
  const assignment = db.assignments.find((entry) => entry.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  if (!isAdmin(req.actor) && assignment.createdByStaffId !== req.actor.id) {
    return res.status(403).json({ error: 'Only the creator can delete this assignment.' });
  }
  mutate((current) => {
    current.assignments = current.assignments.filter((entry) => entry.id !== assignment.id);
    addActivity(current, req.actor, 'Deleted assignment', 'Assignment', assignment.id, assignment.title);
  });
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* Announcements                                                      */
/* ------------------------------------------------------------------ */

app.post('/api/announcements', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const title = str(body.title);
  const message = str(body.body || body.content);
  const importance = str(body.importance) || 'Normal';
  if (!title) return res.status(400).json({ error: 'Announcement title is required.' });
  if (!message) return res.status(400).json({ error: 'Announcement message is required.' });
  if (!IMPORTANCE.has(importance)) {
    return res.status(400).json({ error: 'Select a valid priority.' });
  }
  const autoPin = importance === 'Urgent' || importance === 'Emergency';
  const announcement = {
    id: nextAnnouncementId(db),
    title,
    body: message,
    importance,
    audience: str(body.audience) || 'All',
    isPinned: body.isPinned === undefined ? autoPin : Boolean(body.isPinned) || autoPin,
    publisherName: req.actor.name,
    createdAt: isoNow(),
  };
  mutate((current) => {
    current.announcements.unshift(announcement);
    addActivity(
      current,
      req.actor,
      'Published announcement',
      'Announcement',
      announcement.id,
      announcement.title
    );
  });
  return res.status(201).json({ announcement });
});

app.patch('/api/announcements/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const announcement = db.announcements.find((entry) => entry.id === req.params.id);
  if (!announcement) return res.status(404).json({ error: 'Announcement not found.' });
  const body = req.body || {};
  const allowed = ['title', 'body', 'importance', 'audience', 'isPinned'];
  mutate((current) => {
    const target = current.announcements.find((entry) => entry.id === announcement.id);
    allowed.forEach((field) => {
      if (body[field] !== undefined) target[field] = body[field];
    });
    if (target.importance === 'Urgent' || target.importance === 'Emergency') {
      target.isPinned = true;
    }
    addActivity(
      current,
      req.actor,
      target.isPinned ? 'Pinned announcement' : 'Updated announcement',
      'Announcement',
      target.id,
      target.title
    );
  });
  return res.json({ announcement: getDb().announcements.find((entry) => entry.id === announcement.id) });
});

app.delete('/api/announcements/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const announcement = db.announcements.find((entry) => entry.id === req.params.id);
  if (!announcement) return res.status(404).json({ error: 'Announcement not found.' });
  mutate((current) => {
    current.announcements = current.announcements.filter((entry) => entry.id !== announcement.id);
    addActivity(
      current,
      req.actor,
      'Deleted announcement',
      'Announcement',
      announcement.id,
      announcement.title
    );
  });
  return res.json({ ok: true });
});

/* ------------------------------------------------------------------ */
/* RMS requests                                                       */
/* ------------------------------------------------------------------ */

app.post('/api/rms', requireActor, (req, res) => {
  const db = getDb();
  const body = req.body || {};
  const subject = str(body.subject);
  const message = str(body.body || body.messageBody);
  if (!subject) return res.status(400).json({ error: 'Request subject is required.' });
  if (!message) return res.status(400).json({ error: 'Request details are required.' });
  let category = str(body.category);
  if (!RMS_CATEGORIES.has(category)) category = classifyRms(`${subject} ${message}`);
  const confidential = category === 'confidential' || body.isConfidential === true;

  const ticket = {
    id: `RMS-${Date.now().toString().slice(-6)}`,
    ticketNo: nextTicketNumber(db),
    senderStaffId: req.actor.id,
    senderName: req.actor.name,
    senderEmail: req.actor.email,
    category: confidential ? 'confidential' : category,
    subject,
    body: message,
    room: str(body.room),
    priority: str(body.priority) || 'Medium',
    isConfidential: confidential,
    status: 'pending',
    principalNote: '',
    createdAt: isoNow(),
    resolvedAt: null,
  };
  mutate((current) => {
    current.rmsTickets.unshift(ticket);
    addActivity(
      current,
      req.actor,
      'Raised a request',
      'Request',
      ticket.ticketNo,
      `${ticket.category} · ${ticket.subject}`
    );
  });
  return res.status(201).json({ ticket });
});

app.patch('/api/rms/:id', requireActor, requireAdmin, (req, res) => {
  const db = getDb();
  const ticket = db.rmsTickets.find((entry) => entry.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Request not found.' });
  if (ticket.isConfidential && !isSuperAdmin(req.actor)) {
    return res.status(403).json({ error: 'Confidential requests are restricted to a SuperAdmin.' });
  }
  const body = req.body || {};
  const status = str(body.status);
  if (status && !RMS_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Select a valid request status.' });
  }

  mutate((current) => {
    const target = current.rmsTickets.find((entry) => entry.id === ticket.id);
    if (status) {
      target.status = status;
      target.resolvedAt = ['approved', 'rejected', 'resolved'].includes(status)
        ? isoNow()
        : null;
    }
    if (body.principalNote !== undefined) target.principalNote = str(body.principalNote);
    if (body.priority !== undefined) target.priority = str(body.priority);
    addActivity(
      current,
      req.actor,
      'Updated request status',
      'Request',
      target.ticketNo,
      `${target.subject} → ${target.status}`
    );
  });
  return res.json({ ticket: getDb().rmsTickets.find((entry) => entry.id === ticket.id) });
});

/* ------------------------------------------------------------------ */
/* School settings and demo reset                                     */
/* ------------------------------------------------------------------ */

app.patch('/api/meta', requireActor, requireSuperAdmin, (req, res) => {
  const body = req.body || {};
  const allowed = [
    'schoolName',
    'shortName',
    'tagline',
    'academicYear',
    'address',
    'phone',
    'email',
    'principalName',
  ];
  if (body.schoolName !== undefined && !str(body.schoolName)) {
    return res.status(400).json({ error: 'School name cannot be empty.' });
  }
  if (body.attendanceMode !== undefined && !parseAttendanceMode(body.attendanceMode)) {
    return res.status(400).json({
      error: 'Attendance mode must be "twoSessions" (morning + afternoon) or "fullDay".',
    });
  }
  mutate((current) => {
    allowed.forEach((field) => {
      if (body[field] !== undefined) current.meta[field] = str(body[field]);
    });
    if (body.attendanceMode !== undefined) {
      current.meta.attendanceMode = parseAttendanceMode(body.attendanceMode);
    }
    const modeNote =
      body.attendanceMode !== undefined
        ? ` · attendance: ${
            current.meta.attendanceMode === 'fullDay' ? 'full day' : 'morning + afternoon'
          }`
        : '';
    addActivity(
      current,
      req.actor,
      'Updated school settings',
      'Settings',
      'school',
      `School profile updated${modeNote}`
    );
  });
  return res.json({ meta: getDb().meta });
});

app.post('/api/import', requireActor, requireSuperAdmin, (req, res) => {
  const mode = req.body?.mode === 'replace' ? 'replace' : 'merge';
  const rawCollections = req.body?.collections;
  if (!rawCollections || typeof rawCollections !== 'object' || Array.isArray(rawCollections)) {
    return res.status(400).json({ error: 'Provide an object of CSV datasets to import.' });
  }

  const incoming = {};
  const ignored = [];
  Object.entries(rawCollections).forEach(([key, value]) => {
    if (IMPORT_COLLECTION_KEYS.has(key)) incoming[key] = value;
    else ignored.push(key);
  });
  const keys = Object.keys(incoming);
  if (!keys.length) {
    return res.status(400).json({ error: 'No recognized school datasets were provided.' });
  }

  const current = getDb();
  const importedSchemaVersion = incoming.meta?.schemaVersion;
  if (
    importedSchemaVersion !== undefined &&
    String(importedSchemaVersion) !== String(current.meta.schemaVersion)
  ) {
    return res.status(422).json({
      error: `This backup uses schema ${importedSchemaVersion}; the server expects ${current.meta.schemaVersion}.`,
      errors: [
        {
          collection: 'meta',
          row: 0,
          field: 'schemaVersion',
          message: `Expected schema ${current.meta.schemaVersion}.`,
        },
      ],
    });
  }

  const { merged, summary } = mergeImport(current, incoming, mode);

  // Remember which photos existed before the import so any record that the
  // import removes can have its Cloudinary asset cleaned up afterwards.
  const photosBefore = new Map(
    [...current.staff, ...current.students]
      .filter((entry) => entry.photo?.publicId)
      .map((entry) => [entry.id, entry.photo])
  );

  // Keep server-owned fields stable. The import may change school identity,
  // but the running server owns the schema version, revision and current day.
  merged.meta = {
    ...(merged.meta || {}),
    schemaVersion: current.meta.schemaVersion,
    revision: current.meta.revision,
    today: current.meta.today,
    todayName: current.meta.todayName,
    createdAt: merged.meta?.createdAt || current.meta.createdAt,
    updatedAt: current.meta.updatedAt,
    // A backup may predate the setting, or carry an unsupported value.
    attendanceMode: parseAttendanceMode(merged.meta?.attendanceMode) || current.meta.attendanceMode,
  };

  // Recalculate derived fields across the whole merged state so partial
  // imports (for example students.csv alone) keep class counts and marks
  // percentages consistent.
  normalizeImportedData(merged);

  const errors = validateImportedData(merged, { actorId: req.actor.id });
  if (errors.length) {
    return res.status(422).json({
      error: 'Import validation failed. Nothing was written.',
      errors: errors.slice(0, 250),
      ignored,
    });
  }

  mutate((db) => {
    // Apply the normalized merged state for every collection. Imported tables
    // keep their requested merge/replace semantics; untouched tables are
    // identical to the current data but may receive recalculated derived
    // fields (student counts, teacher names, percentages).
    IMPORT_COLLECTIONS.forEach((def) => {
      if (def.key === 'meta') {
        db.meta = {
          ...merged.meta,
          schemaVersion: db.meta.schemaVersion,
          revision: db.meta.revision,
          today: db.meta.today,
          todayName: db.meta.todayName,
          updatedAt: db.meta.updatedAt,
        };
        return;
      }
      if (merged[def.key] !== undefined) db[def.key] = merged[def.key];
    });
    const countText = keys
      .map((key) => {
        const entry = summary[key];
        if (!entry) return key;
        return `${key}:${entry.after}`;
      })
      .join(' · ');
    addActivity(
      db,
      req.actor,
      'Imported CSV data',
      'Data exchange',
      `import-${Date.now()}`,
      `${mode} · ${countText}${ignored.length ? ` · ignored:${ignored.join(',')}` : ''}`
    );
  });

  const db = getDb();
  const survivors = new Set([...db.staff, ...db.students].map((entry) => entry.id));
  photosBefore.forEach((photo, id) => {
    if (!survivors.has(id)) discardPhoto(photo, 'removed by import');
  });

  return res.json({
    ok: true,
    mode,
    imported: keys,
    summary,
    ignored,
    revision: db.meta.revision,
    updatedAt: db.meta.updatedAt,
  });
});

app.post('/api/reset', requireActor, requireSuperAdmin, (req, res) => {
  const before = getDb();
  const photos = [...before.staff, ...before.students]
    .map((entry) => entry.photo)
    .filter(Boolean);

  const db = resetStore();

  // The seed has no photos, so every uploaded asset for this data set is now
  // orphaned. Removing them keeps Cloudinary from slowly accumulating junk.
  photos.forEach((photo) => discardPhoto(photo, 'demo reset'));

  res.json({
    ok: true,
    revision: db.meta.revision,
    message: 'Demo database restored to its original seed.',
  });
});

/* ------------------------------------------------------------------ */
/* Static apps and landing page                                       */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Identity and profile photos                                         */
/* ------------------------------------------------------------------ */

function isPrincipal(staff) {
  return String(staff?.staffType || '').toLowerCase() === 'principal';
}

/**
 * Photo mutation policy.
 *   - Principal / SuperAdmin: any staff or student photo.
 *   - TeacherApp: only their own staff photo (token uid === staff id).
 *   - Everyone else: read-only.
 */
function canManagePhoto(actor, kind, targetId) {
  if (isSuperAdmin(actor) || isPrincipal(actor)) return true;
  return kind === 'staff' && actor.id === targetId;
}

function findPhotoTarget(db, kind, id) {
  const collection = kind === 'staff' ? db.staff : db.students;
  const index = collection.findIndex((entry) => entry.id === id);
  return index === -1 ? null : { collection, index };
}

/**
 * Deletes a Cloudinary asset that is no longer referenced by any record.
 *
 * Always fire-and-forget: a media cleanup failure must never roll back the
 * data change the user asked for. The log line is the trail for a manual sweep.
 */
function discardPhoto(photo, reason) {
  const publicId = photo?.publicId;
  if (!publicId) return;
  destroyAsset(publicId).catch((error) =>
    console.error(`[cloudinary] orphan not removed (${reason}, ${publicId}):`, error.message)
  );
}

app.get('/api/me', requireActor, (req, res) => {
  const db = getDb();
  res.json({
    user: req.actor,
    permissions: {
      admin: isAdmin(req.actor),
      superAdmin: isSuperAdmin(req.actor),
      principal: isPrincipal(req.actor),
      teacherClassIds: teacherClassIds(db, req.actor.id),
    },
  });
});

app.post('/api/auth/cloudinary-sign', requireActor, (req, res) => {
  const kind = str(req.body?.kind);
  const id = str(req.body?.id);

  if (!PHOTO_FOLDERS[kind] || !id) {
    return res.status(400).json({ error: 'A valid kind (staff|students) and id are required.' });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({ error: 'Photo uploads are not configured on the server.' });
  }
  if (!canManagePhoto(req.actor, kind, id)) {
    return res.status(403).json({ error: 'You can only change your own profile photo.' });
  }
  if (!findPhotoTarget(getDb(), kind, id)) {
    return res.status(404).json({ error: 'No such record.' });
  }

  return res.json(buildSignedUpload({ kind, id }));
});

function registerPhotoRoutes(kind, routePath) {
  app.patch(routePath, requireActor, (req, res) => {
    const id = str(req.params.id);
    const url = str(req.body?.url);
    const publicId = str(req.body?.publicId);

    if (!canManagePhoto(req.actor, kind, id)) {
      return res.status(403).json({ error: 'You can only change your own profile photo.' });
    }
    if (!url || !publicId) {
      return res.status(400).json({ error: 'url and publicId are required.' });
    }
    if (!isOwnCloudinaryUrl(url)) {
      return res.status(400).json({ error: 'That image URL is not from this school account.' });
    }

    const expectedPublicId = `${PHOTO_FOLDERS[kind]}/${id}`;
    if (publicId !== expectedPublicId) {
      return res.status(400).json({ error: 'That image does not belong to this record.' });
    }

    const db = getDb();
    const target = findPhotoTarget(db, kind, id);
    if (!target) return res.status(404).json({ error: 'No such record.' });

    const previous = target.collection[target.index].photo;

    mutate((current) => {
      const record = kind === 'staff'
        ? current.staff.find((entry) => entry.id === id)
        : current.students.find((entry) => entry.id === id);
      record.photo = {
        url,
        publicId,
        updatedAt: isoNow(),
        updatedBy: req.actor.id,
      };
    });

    if (previous?.publicId && previous.publicId !== publicId) {
      discardPhoto(previous, 'replaced');
    }

    const updated = findPhotoTarget(getDb(), kind, id);
    return res.json({ photo: updated.collection[updated.index].photo });
  });

  app.delete(routePath, requireActor, (req, res) => {
    const id = str(req.params.id);

    if (!canManagePhoto(req.actor, kind, id)) {
      return res.status(403).json({ error: 'You can only change your own profile photo.' });
    }

    const db = getDb();
    const target = findPhotoTarget(db, kind, id);
    if (!target) return res.status(404).json({ error: 'No such record.' });

    const previous = target.collection[target.index].photo;
    if (!previous) return res.json({ photo: null, message: 'There was no photo to remove.' });

    mutate((current) => {
      const record = kind === 'staff'
        ? current.staff.find((entry) => entry.id === id)
        : current.students.find((entry) => entry.id === id);
      delete record.photo;
    });

    discardPhoto(previous, 'removed');

    return res.json({ photo: null });
  });
}

registerPhotoRoutes('staff', '/api/staff/:id/photo');
registerPhotoRoutes('students', '/api/students/:id/photo');

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'API route not found.' });
});

const teacherDist = path.join(ROOT, 'teacher-app', 'dist');
const adminDist = path.join(ROOT, 'admin-panel', 'dist');
const IS_WORKERS = String(process.env.RUNTIME || '') === 'workers';

function mountSpa(basePath, distDir, label) {
  // In production the two PWAs are their own Workers; the API owns no static
  // files and must never try to read them (Workers have no project filesystem).
  if (IS_WORKERS) return;

  // index:false so the handler below can rewrite root-absolute asset URLs.
  app.use(basePath, express.static(distDir, { index: false }));

  const serveIndex = (req, res) => {
    const indexFile = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexFile)) {
      return res
        .status(503)
        .send(
          `<html><body style="font-family:system-ui;padding:48px;background:#f8fafc;color:#1e293b">
          <h1>${label} build not found</h1>
          <p>Run <code>npm run build</code> from the project root, then reload.</p>
          <p>For development, use <code>npm run dev</code>.</p>
        </body></html>`
        );
    }

    // Each app is built with base '/' so it can own its own origin in production.
    // When previewing both from this one server, rewrite root-absolute URLs onto
    // the mount path so assets still resolve.
    const html = fs
      .readFileSync(indexFile, 'utf8')
      .replaceAll('href="/', `href="${basePath}/`)
      .replaceAll('src="/', `src="${basePath}/`);

    return res.type('html').send(html);
  };

  app.get(`${basePath}/*`, serveIndex);
  app.get(basePath, serveIndex);
}

mountSpa('/teacher', teacherDist, 'Teacher app');
mountSpa('/admin', adminDist, 'Admin panel');

if (IS_WORKERS) {
  app.get('/', (req, res) => {
    res.json({
      service: 'Nawaz School API',
      status: 'ok',
      docs: '/api/health',
      teacherApp: 'https://nawaz-school-teacher.srikarsensai.workers.dev',
      adminPanel: 'https://nawaz-school-admin.srikarsensai.workers.dev',
    });
  });
} else {
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });
}

app.use((error, req, res, next) => {
  console.error('[api]', error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'The local server hit an unexpected error.' });
});

// On Workers, async I/O in the global scope is forbidden, so the entry point
// starts the store on the first request instead. The Node server boots eagerly.
export const ready =
  String(process.env.RUNTIME || '') === 'workers'
    ? Promise.resolve()
    : initStoreAsync().catch((error) => console.error('[data] boot failed:', error.message));

ready.finally(() => {
  app.listen(PORT, () => {
      const db = getDb();
      console.log('');
      console.log('  Nawaz School RMS - local prototype server');
      console.log(`  API:      http://localhost:${PORT}/api/health`);
      console.log(`  Launcher: http://localhost:${PORT}/`);
      console.log(`  Teacher:  http://localhost:${PORT}/teacher/  (dev: http://localhost:5173/)`);
      console.log(`  Admin:    http://localhost:${PORT}/admin/    (dev: http://localhost:5174/)`);
      console.log(`  Data:     ${getDatabaseFile()}`);
      console.log(
        `  Seed:     revision ${db.meta.revision} - ${db.students.length} students - ${db.staff.length} staff`
      );
      console.log(
        hasConfiguredOrigins()
          ? '  CORS:     allowlist from CORS_ORIGINS'
          : '  CORS:     dev origins only - set CORS_ORIGINS before deploying'
      );
      console.log('');
    });
  });
