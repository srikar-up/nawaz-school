import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:4000';

async function api(path, { method = 'GET', body, staffId } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (staffId) headers['x-staff-id'] = staffId;
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { status: response.status, payload, text };
}

function log(label, detail = '') {
  console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`);
}

const results = [];

// 1. Health + static hosting ------------------------------------------------
{
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.payload.ok, true);
  assert.equal(health.payload.mode, 'local-json');
  results.push(`health revision ${health.payload.revision}`);
  log('API health', `revision ${health.payload.revision}`);

  const launcher = await fetch(`${BASE}/`);
  assert.equal(launcher.status, 200);
  const launcherHtml = await launcher.text();
  assert.ok(launcherHtml.includes('Teacher Workspace'));
  assert.ok(launcherHtml.includes('Admin Console'));
  log('Launcher page', 'teacher and admin entry points');

  const teacherPage = await fetch(`${BASE}/teacher/`);
  assert.equal(teacherPage.status, 200);
  const teacherHtml = await teacherPage.text();
  assert.ok(teacherHtml.includes('Nawaz School'));
  assert.ok(teacherHtml.includes('/teacher/assets/'));

  const adminPage = await fetch(`${BASE}/admin/`);
  assert.equal(adminPage.status, 200);
  const adminHtml = await adminPage.text();
  assert.ok(adminHtml.includes('Nawaz School'));
  assert.ok(adminHtml.includes('/admin/assets/'));
  log('Static PWAs', 'teacher + admin bundles served');

  for (const asset of [
    '/teacher/manifest.webmanifest',
    '/admin/manifest.webmanifest',
    '/teacher/sw.js',
    '/admin/sw.js',
    '/teacher/icons/icon-192.png',
    '/admin/icons/icon-192.png',
    '/teacher/school-logo.jpg',
    '/admin/school-logo.png',
  ]) {
    const response = await fetch(`${BASE}${asset}`);
    assert.equal(response.status, 200, `${asset} should be served`);
  }
  log('PWA assets', 'manifests, service workers, icons');
}

// 2. Login + full state ----------------------------------------------------
const adminLogin = await api('/api/auth/login', {
  method: 'POST',
  body: { email: 'admin@nawazschool.edu', password: 'admin123' },
});
assert.equal(adminLogin.status, 200);
assert.equal(adminLogin.payload.user.accessLevel, 'SuperAdmin');
const adminId = adminLogin.payload.user.id;
log('Admin login', `${adminLogin.payload.user.name} · ${adminLogin.payload.user.accessLevel}`);

const teacherLogin = await api('/api/auth/login', {
  method: 'POST',
  body: { email: 'teacher@nawazschool.edu', password: 'teacher123' },
});
assert.equal(teacherLogin.status, 200);
assert.equal(teacherLogin.payload.user.accessLevel, 'TeacherApp');
const teacherId = teacherLogin.payload.user.id;
log('Teacher login', `${teacherLogin.payload.user.name} · ${teacherLogin.payload.user.accessLevel}`);

const badLogin = await api('/api/auth/login', {
  method: 'POST',
  body: { email: 'teacher@nawazschool.edu', password: 'wrong-password' },
});
assert.equal(badLogin.status, 401);
log('Password validation', 'wrong password rejected');

const adminState = (await api('/api/state', { staffId: adminId })).payload;
assert.ok(adminState.students.length >= 50);
assert.ok(adminState.staff.length >= 10);
assert.ok(adminState.timetable.length >= 100);
assert.ok(adminState.attendanceSessions.length >= 80);
assert.ok(adminState.announcements.length >= 5);
log(
  'Seed data',
  `${adminState.students.length} students · ${adminState.staff.length} staff · ${adminState.timetable.length} periods`
);

// 3. Admin → teacher announcement sync ------------------------------------
const newNotice = await api('/api/announcements', {
  method: 'POST',
  staffId: adminId,
  body: {
    title: 'Smoke test announcement',
    body: 'This update verifies that admin broadcasts reach the teacher app.',
    importance: 'Urgent',
    audience: 'TeachersOnly',
  },
});
assert.equal(newNotice.status, 201);
const noticeId = newNotice.payload.announcement.id;
assert.equal(newNotice.payload.announcement.isPinned, true);
const teacherAfterNotice = (await api('/api/state', { staffId: teacherId })).payload;
assert.ok(teacherAfterNotice.announcements.some((notice) => notice.id === noticeId));
log('Admin → teacher announcement', `created ${noticeId} and visible in teacher state`);

// 4. Teacher attendance → admin state -------------------------------------
const sessionDate = adminState.meta.today;
const attendanceResponse = await api('/api/attendance', {
  method: 'POST',
  staffId: teacherId,
  body: {
    classIdSection: '10-A',
    date: sessionDate,
    sessionType: 'Morning',
    entries: adminState.students
      .filter((student) => student.classIdSection === '10-A')
      .map((student) => ({ studentId: student.id, status: 'present', remarks: '' })),
  },
});
assert.equal(attendanceResponse.status, 200);
assert.equal(attendanceResponse.payload.attendance.classIdSection, '10-A');
const adminAfterAttendance = (await api('/api/state', { staffId: adminId })).payload;
const sharedSession = adminAfterAttendance.attendanceSessions.find(
  (session) =>
    session.classIdSection === '10-A' &&
    session.date === sessionDate &&
    session.sessionType === 'Morning'
);
assert.ok(sharedSession);
assert.ok(sharedSession.entries.every((entry) => entry.status === 'present'));
log('Teacher → admin attendance', `10-A register saved for ${sessionDate} and visible to admin`);

// 5. Teacher request → admin decision -------------------------------------
const newRequest = await api('/api/rms', {
  method: 'POST',
  staffId: teacherId,
  body: {
    category: 'maintenance',
    subject: 'Smoke test — projector check',
    body: 'Verify the shared request desk is working between the teacher app and admin console.',
    room: 'Room 204',
    priority: 'High',
  },
});
assert.equal(newRequest.status, 201);
const requestId = newRequest.payload.ticket.id;
const adminAfterRequest = (await api('/api/state', { staffId: adminId })).payload;
assert.ok(adminAfterRequest.rmsTickets.some((ticket) => ticket.id === requestId));
log('Teacher → admin request', `ticket ${newRequest.payload.ticket.ticketNo} visible in admin state`);

const approved = await api(`/api/rms/${requestId}`, {
  method: 'PATCH',
  staffId: adminId,
  body: { status: 'approved', principalNote: 'Smoke test approved.' },
});
assert.equal(approved.status, 200);
const teacherAfterDecision = (await api('/api/state', { staffId: teacherId })).payload;
assert.equal(
  teacherAfterDecision.rmsTickets.find((ticket) => ticket.id === requestId).status,
  'approved'
);
log('Admin decision → teacher', 'request status approved and visible to teacher');

// 6. Teacher exam visibility + assigned-teacher guard ----------------------
const teacherState = (await api('/api/state', { staffId: teacherId })).payload;
assert.ok(
  teacherState.staff.some(
    (member) => member.id !== teacherId && member.staffType === 'Teacher' && member.isActive
  ),
  'Teacher state should include other active teachers for the school directory'
);
assert.ok(
  teacherState.exams.some((exam) => exam.assignedStaffId !== teacherId),
  'Teacher state should include school-wide exams assigned to colleagues'
);
const colleagueExam = teacherState.exams.find((exam) => {
  if (exam.assignedStaffId === teacherId) return false;
  if (exam.marksStatus === 'Submitted' || exam.marksStatus === 'Locked') return false;
  return new Date(`${exam.date}T${exam.endTime}:00`) < new Date();
});
assert.ok(colleagueExam, 'Expected an open exam assigned to another teacher');
const colleagueRoster = teacherState.students.filter(
  (student) => student.classIdSection === colleagueExam.classIdSection
);
const forbiddenMarks = await api(`/api/exams/${colleagueExam.id}/marks`, {
  method: 'POST',
  staffId: teacherId,
  body: {
    records: [{ studentId: colleagueRoster[0].id, marksObtained: 1 }],
  },
});
assert.equal(forbiddenMarks.status, 403);
log(
  'Teacher exam scope',
  `${colleagueExam.title} visible read-only; marks entry rejected for non-assigned teacher`
);

// 7. Teacher marks submission → admin result state ------------------------
const openExam = teacherState.exams.find((exam) => {
  if (exam.marksStatus === 'Submitted' || exam.marksStatus === 'Locked') return false;
  if (exam.assignedStaffId !== teacherId) return false;
  const end = new Date(`${exam.date}T${exam.endTime}:00`);
  return end < new Date();
});
assert.ok(openExam, 'Expected an open exam assigned to the demo teacher');
const examRoster = teacherState.students.filter(
  (student) => student.classIdSection === openExam.classIdSection
);
const marksResponse = await api(`/api/exams/${openExam.id}/marks`, {
  method: 'POST',
  staffId: teacherId,
  body: {
    records: examRoster.map((student, index) => ({
      studentId: student.id,
      marksObtained: Math.round((openExam.maxMarks * (0.55 + (index % 5) * 0.08)) * 10) / 10,
    })),
  },
});
assert.equal(marksResponse.status, 200);
assert.equal(marksResponse.payload.exam.marksStatus, 'Submitted');
assert.equal(marksResponse.payload.records.length, examRoster.length);
const adminAfterMarks = (await api('/api/state', { staffId: adminId })).payload;
const sharedExam = adminAfterMarks.exams.find((exam) => exam.id === openExam.id);
assert.equal(sharedExam.marksStatus, 'Submitted');
assert.equal(
  adminAfterMarks.testRecords.filter((record) => record.examId === openExam.id).length,
  examRoster.length
);
log(
  'Teacher marks → admin results',
  `${openExam.title} · ${examRoster.length} scores submitted`
);

// 8. Admin student CRUD ---------------------------------------------------
const createdStudent = await api('/api/students', {
  method: 'POST',
  staffId: adminId,
  body: {
    name: 'Smoke Test Student',
    classIdSection: '10-B',
    rollNumber: '99',
    parentPhone: '+92 300 0000000',
  },
});
assert.equal(createdStudent.status, 201);
const studentId = createdStudent.payload.student.id;
const teacherAfterStudent = (await api('/api/state', { staffId: teacherId })).payload;
assert.ok(teacherAfterStudent.students.some((student) => student.id === studentId));
const deletedStudent = await api(`/api/students/${studentId}`, {
  method: 'DELETE',
  staffId: adminId,
});
assert.equal(deletedStudent.status, 200);
log('Student CRUD', 'created and deleted; teacher state shared');

// 9. Publish cleanup + reset ---------------------------------------------
const deleteNotice = await api(`/api/announcements/${noticeId}`, {
  method: 'DELETE',
  staffId: adminId,
});
assert.equal(deleteNotice.status, 200);

// 9. CSV import: dry-run validation + full replace ------------------------
const brokenImport = await api('/api/import', {
  method: 'POST',
  staffId: adminId,
  body: {
    mode: 'merge',
    collections: {
      students: [{ ...adminState.students[0], classIdSection: '99-Z' }],
    },
  },
});
assert.equal(brokenImport.status, 422);
assert.ok(
  brokenImport.payload.errors.some((error) => error.field === 'classIdSection'),
  'broken class foreign key should be reported'
);

const importPayload = {
  mode: 'replace',
  collections: Object.fromEntries(
    [
      'meta',
      'staff',
      'classes',
      'students',
      'subjects',
      'timetable',
      'exams',
      'testRecords',
      'assignments',
      'attendanceSessions',
      'staffAttendance',
      'classIncharges',
      'announcements',
      'rmsTickets',
      'activities',
    ].map((key) => [key, adminState[key]])
  ),
};
importPayload.collections.meta = {
  ...adminState.meta,
  shortName: 'Nawaz Import Test',
};
const imported = await api('/api/import', {
  method: 'POST',
  staffId: adminId,
  body: importPayload,
});
assert.equal(imported.status, 200);
assert.equal(imported.payload.mode, 'replace');
const afterImport = (await api('/api/state', { staffId: adminId })).payload;
assert.equal(afterImport.meta.shortName, 'Nawaz Import Test');
assert.equal(afterImport.students.length, adminState.students.length);
assert.equal(afterImport.staff.length, adminState.staff.length);
log(
  'CSV data exchange',
  'invalid foreign key rejected (422); full dataset import accepted and synced'
);

// 10. Timetable builder: Saturday, conflicts, publish lock -----------------
const timetablePeriods = Array.isArray(afterImport.meta.timetablePeriods)
  ? afterImport.meta.timetablePeriods
  : [
      { periodNumber: 1, startTime: '08:30', endTime: '09:15' },
      { periodNumber: 2, startTime: '09:20', endTime: '10:05' },
      { periodNumber: 3, startTime: '10:15', endTime: '11:00' },
      { periodNumber: 4, startTime: '11:05', endTime: '11:50' },
      { periodNumber: 5, startTime: '12:30', endTime: '13:15' },
      { periodNumber: 6, startTime: '13:20', endTime: '14:05' },
    ];
const saturdaySettings = await api('/api/timetable/settings', {
  method: 'PATCH',
  staffId: adminId,
  body: {
    days: [1, 2, 3, 4, 5, 6],
    periods: timetablePeriods,
    editUntil: '2099-12-31',
    status: 'draft',
  },
});
assert.equal(saturdaySettings.status, 200);
assert.deepEqual(saturdaySettings.payload.config.days, [1, 2, 3, 4, 5, 6]);

const subjectA = afterImport.subjects.find((subject) => subject.classIdSection === '10-A');
const subjectB = afterImport.subjects.find((subject) => subject.classIdSection === '10-B');
const teacherA =
  subjectA?.assignedStaffId || afterImport.staff.find((member) => member.isActive)?.id;
const newSlot = await api('/api/timetable', {
  method: 'PUT',
  staffId: adminId,
  body: {
    classIdSection: '10-A',
    dayOfWeek: 6,
    periodNumber: 1,
    subjectId: subjectA.id,
    teacherStaffId: teacherA,
    room: 'Room 204',
  },
});
assert.equal(newSlot.status, 200);
assert.equal(newSlot.payload.entry.dayOfWeek, 6);
const slotId = newSlot.payload.entry.id;

const conflictingSlot = await api('/api/timetable', {
  method: 'PUT',
  staffId: adminId,
  body: {
    classIdSection: '10-B',
    dayOfWeek: 6,
    periodNumber: 1,
    subjectId: subjectB.id,
    teacherStaffId: teacherA,
  },
});
assert.equal(conflictingSlot.status, 409);

const published = await api('/api/timetable/settings', {
  method: 'PATCH',
  staffId: adminId,
  body: {
    days: [1, 2, 3, 4, 5, 6],
    periods: timetablePeriods,
    editUntil: '2099-12-31',
    status: 'published',
  },
});
assert.equal(published.status, 200);
assert.equal(published.payload.config.status, 'published');
const lockedEdit = await api('/api/timetable', {
  method: 'PUT',
  staffId: adminId,
  body: {
    classIdSection: '10-A',
    dayOfWeek: 6,
    periodNumber: 1,
    subjectId: subjectA.id,
    teacherStaffId: teacherA,
  },
});
assert.equal(lockedEdit.status, 409);

const reopened = await api('/api/timetable/settings', {
  method: 'PATCH',
  staffId: adminId,
  body: {
    days: [1, 2, 3, 4, 5, 6],
    periods: timetablePeriods,
    editUntil: '2099-12-31',
    status: 'draft',
  },
});
assert.equal(reopened.status, 200);
const deletedSlot = await api(`/api/timetable/${slotId}`, {
  method: 'DELETE',
  staffId: adminId,
});
assert.equal(deletedSlot.status, 200);
log(
  'Timetable builder',
  'Saturday enabled; teacher conflict and published lock rejected; slot removed'
);

const reset = await api('/api/reset', { method: 'POST', staffId: adminId });
assert.equal(reset.status, 200);
const resetState = (await api('/api/state', { staffId: adminId })).payload;
assert.equal(resetState.students.length, adminState.students.length);
assert.equal(resetState.announcements.length, adminState.announcements.length);
assert.equal(resetState.rmsTickets.length, adminState.rmsTickets.length);
assert.ok(
  resetState.exams.find((exam) => exam.id === openExam.id).marksStatus !== 'Submitted',
  'reset should restore the exam to its seed status'
);
log('Demo reset', `revision ${reset.payload.revision} · seed restored`);

console.log('\nAll smoke tests passed.');
console.log(results.map((line) => `  · ${line}`).join('\n'));
