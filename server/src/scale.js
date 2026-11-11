/**
 * Scale model used by the load test and by `/api/diagnostics`.
 *
 * It deliberately does not write to Firestore. It answers the questions that
 * matter before a real school is onboarded:
 *   - how large does each document get at 1,000 students?
 *   - how many documents does a cold start read?
 *   - how many writes does one register or marks submission cost?
 */
import { buildSeed } from './seed.js';
import {
  CONFIG_COLLECTIONS,
  MAX_DOCUMENT_BYTES,
  RECORD_COLLECTIONS,
} from './firestore-store.js';

function bytes(value) {
  const text = JSON.stringify(value);
  if (typeof Buffer !== 'undefined') return Buffer.byteLength(text, 'utf8');
  return new TextEncoder().encode(text).length;
}

function pad(value, size) {
  return String(value).padStart(size, '0');
}

function isoDay(offset) {
  const date = new Date(Date.UTC(2026, 7, 1));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/**
 * Builds a realistic worst-case term:
 *   1,000 students, 50 staff, 30 sections, 60 school days of two registers and
 *   four whole-school exam cycles.
 */
export function buildScaleFixture({
  studentCount = 1000,
  staffCount = 50,
  sectionCount = 30,
  schoolDays = 60,
  examCycles = 4,
} = {}) {
  const seed = buildSeed();
  const sections = Array.from({ length: sectionCount }, (_, index) => {
    const grade = 8 + Math.floor(index / 10);
    const letter = String.fromCharCode(65 + (index % 10));
    return {
      id: `${grade}-${letter}`,
      displayName: `Grade ${grade} — ${letter}`,
      gradeLevel: String(grade),
      section: letter,
      room: `Room ${index + 1}`,
      studentCount: 0,
    };
  });

  const studentsPerSection = Math.ceil(studentCount / sectionCount);
  const students = [];
  for (let index = 0; index < studentCount; index += 1) {
    const section = sections[index % sectionCount];
    const roll = pad(Math.floor(index / sectionCount) + 1, 2);
    const id = `STU-SCALE-${pad(index + 1, 4)}`;
    students.push({
      id,
      code: id,
      rollNumber: roll,
      name: `Student ${pad(index + 1, 4)}`,
      classIdSection: section.id,
      guardianName: `Guardian ${pad(index + 1, 4)}`,
      parentPhone: `0300-${pad(index, 7)}`,
      gender: index % 2 ? 'Female' : 'Male',
      dateOfBirth: '2012-04-12',
      address: `House ${index + 1}, Model Town`,
      admissionDate: '2026-04-01',
      status: 'Active',
      createdAt: '2026-04-01T08:00:00.000Z',
    });
  }

  const staff = Array.from({ length: staffCount }, (_, index) => ({
    id: `STF-${pad(index + 1, 3)}`,
    code: `STF-${pad(index + 1, 3)}`,
    name: `Teacher ${pad(index + 1, 3)}`,
    email: `teacher${index + 1}@example.edu`,
    phone: `0301-${pad(index, 7)}`,
    staffType: index === 0 ? 'Principal' : 'Teacher',
    department: 'General',
    accessLevel: index === 0 ? 'SuperAdmin' : 'TeacherApp',
    isActive: true,
    joinedOn: '2026-04-01',
    avatarColor: '#4338CA',
  }));

  const subjects = [];
  sections.forEach((section, sectionIndex) => {
    ['Mathematics', 'English', 'Science', 'Urdu', 'Islamiat', 'Computer'].forEach(
      (name, subjectIndex) => {
        subjects.push({
          id: `sub-${section.id.toLowerCase()}-${name.toLowerCase()}`,
          classIdSection: section.id,
          subjectName: name,
          subjectCode: name.slice(0, 3).toUpperCase(),
          isLab: name === 'Science' || name === 'Computer',
          assignedStaffId: staff[(sectionIndex + subjectIndex) % staff.length].id,
          assignedTeacherName: staff[(sectionIndex + subjectIndex) % staff.length].name,
          chapters: Array.from({ length: 10 }, (_, chapter) => ({
            title: `${name} Chapter ${chapter + 1}`,
            status: chapter < 4 ? 'completed' : 'pending',
          })),
          updatedAt: '2026-08-01T08:00:00.000Z',
        });
      }
    );
  });

  const attendanceSessions = [];
  for (let day = 0; day < schoolDays; day += 1) {
    const date = isoDay(day);
    if (new Date(`${date}T12:00:00Z`).getUTCDay() === 0) continue;
    sections.forEach((section) => {
      const roster = students
        .filter((student) => student.classIdSection === section.id)
        .slice(0, studentsPerSection);
      ['Morning', 'Afternoon'].forEach((sessionType) => {
        attendanceSessions.push({
          id: `ATT-${section.id}-${date}-${sessionType}`,
          classIdSection: section.id,
          date,
          dayOfWeek: new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', {
            weekday: 'long',
            timeZone: 'UTC',
          }),
          sessionType,
          periodNumber: null,
          submittedByStaffId: staff[0].id,
          submittedAt: `${date}T08:15:00.000Z`,
          entries: roster.map((student, index) => ({
            studentId: student.id,
            status: index % 17 === 0 ? 'absent' : 'present',
            remarks: '',
          })),
        });
      });
    });
  }

  const exams = [];
  const testRecords = [];
  for (let cycle = 0; cycle < examCycles; cycle += 1) {
    sections.forEach((section, sectionIndex) => {
      const subject = subjects[sectionIndex * 6];
      const exam = {
        id: `EXM-SCALE-${cycle}-${section.id}`,
        title: `Term ${cycle + 1} Mathematics`,
        classIdSection: section.id,
        subjectId: subject.id,
        subject: subject.subjectName,
        category: 'endTerm',
        date: isoDay(cycle * 20),
        startTime: '09:00',
        endTime: '11:00',
        maxMarks: 100,
        assignedStaffId: subject.assignedStaffId,
        marksStatus: 'Submitted',
        createdAt: '2026-08-01T08:00:00.000Z',
        submittedAt: isoDay(cycle * 20),
      };
      exams.push(exam);
      students
        .filter((student) => student.classIdSection === section.id)
        .forEach((student, index) => {
          const marks = 35 + ((index * 7 + cycle * 3) % 61);
          testRecords.push({
            id: `TR-${exam.id}-${student.id}`,
            examId: exam.id,
            examTitle: exam.title,
            studentId: student.id,
            studentName: student.name,
            classIdSection: section.id,
            subject: exam.subject,
            category: exam.category,
            marksObtained: marks,
            maxMarks: exam.maxMarks,
            percentage: marks,
            enteredByStaffId: exam.assignedStaffId,
            enteredAt: exam.submittedAt,
          });
        });
    });
  }

  const timetable = [];
  sections.forEach((section) => {
    for (let day = 1; day <= 6; day += 1) {
      for (let period = 1; period <= 8; period += 1) {
        const subject = subjects[(sections.indexOf(section) * 6 + period) % subjects.length];
        timetable.push({
          id: `TT-${section.id}-D${day}-P${period}`,
          classIdSection: section.id,
          className: section.displayName,
          subjectId: subject.id,
          subjectCode: subject.subjectCode,
          subject: subject.subjectName,
          teacherStaffId: subject.assignedStaffId,
          teacherName: subject.assignedTeacherName,
          dayOfWeek: day,
          dayName: ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
          periodNumber: period,
          startTime: `0${8 + Math.floor(period / 2)}:${period % 2 ? '00' : '30'}`,
          endTime: `0${8 + Math.floor(period / 2) + 1}:${period % 2 ? '30' : '00'}`,
          room: section.room,
          isLab: subject.isLab,
        });
      }
    }
  });

  const classIncharges = sections.map((section, index) => ({
    id: `INC-${section.id}`,
    classIdSection: section.id,
    activeStaffId: staff[index % staff.length].id,
    activeStaffName: staff[index % staff.length].name,
  }));

  const staffAttendance = [];
  for (let day = 0; day < schoolDays; day += 1) {
    const date = isoDay(day);
    staff.forEach((member) => {
      staffAttendance.push({
        id: `SA-${member.id}-${date}`,
        staffId: member.id,
        staffName: member.name,
        date,
        status: 'present',
      });
    });
  }

  const activities = Array.from({ length: 150 }, (_, index) => ({
    id: `AUD-SCALE-${pad(index + 1, 4)}`,
    actorId: staff[0].id,
    actorName: staff[0].name,
    action: 'Updated student record',
    entity: 'Student',
    entityId: `STU-SCALE-${pad(index + 1, 4)}`,
    detail: 'Load-test activity row',
    createdAt: isoDay(index % schoolDays),
  }));

  const db = {
    ...seed,
    meta: {
      ...seed.meta,
      layoutVersion: 2,
      revision: 1,
      schoolName: 'Scale Test School',
    },
    staff,
    classes: sections,
    students,
    subjects,
    timetable,
    exams,
    testRecords,
    attendanceSessions,
    staffAttendance,
    classIncharges,
    activities,
  };

  return db;
}

/** Per-collection sizes under the layout v2 write model. */
export function measureScale(db) {
  const collections = {};

  for (const key of [...CONFIG_COLLECTIONS, ...RECORD_COLLECTIONS]) {
    const rows = db[key] || [];
    const sizes = rows.map((row) => bytes(row));
    collections[key] = {
      rows: rows.length,
      layout: RECORD_COLLECTIONS.includes(key) ? 'per-record' : 'single-document',
      documentBytes: RECORD_COLLECTIONS.includes(key)
        ? Math.max(0, ...sizes)
        : bytes({ items: rows }),
      largestRecordBytes: Math.max(0, ...sizes),
    };
  }

  const recordDocuments = RECORD_COLLECTIONS.reduce(
    (sum, key) => sum + (db[key]?.length || 0),
    0
  );
  const coldStartReads = recordDocuments + CONFIG_COLLECTIONS.length + 1;
  const largestDocument = Math.max(...Object.values(collections).map((entry) => entry.documentBytes));

  return {
    revision: db.meta?.revision,
    students: db.students?.length || 0,
    staff: db.staff?.length || 0,
    sections: db.classes?.length || 0,
    collections,
    recordDocuments,
    configDocuments: CONFIG_COLLECTIONS.length + 1,
    coldStartReads,
    largestDocument,
    overLimit: largestDocument > MAX_DOCUMENT_BYTES,
    writesPerAttendanceSubmission: 3, // register + meta + capped activity log
    writesPerMarksSubmission: 36, // 33 marks + exam + meta + activity (one class)
    totalStateBytes: bytes(db),
  };
}
