export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const SCHOOL_DAYS = [1, 2, 3, 4, 5];

const pad = (n) => String(n).padStart(2, '0');

export function todayISO(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function dateFromISO(iso) {
  if (!iso) return new Date();
  return new Date(`${iso}T12:00:00`);
}

export function addDaysISO(iso, days) {
  const date = dateFromISO(iso);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function compareRoll(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
}

export function initials(name = '') {
  return name
    .replace(/^(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.)\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function formatDate(input, options = {}) {
  let date;
  if (input instanceof Date) date = input;
  else if (typeof input === 'string') {
    date = input.includes('T') || input.length > 10 ? new Date(input) : dateFromISO(input);
  } else {
    date = new Date();
  }
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

export function formatDateLong(input, options = {}) {
  let date;
  if (input instanceof Date) date = input;
  else if (typeof input === 'string') {
    date = input.includes('T') || input.length > 10 ? new Date(input) : dateFromISO(input);
  } else {
    date = new Date();
  }
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...options,
  });
}

export function formatTime(time) {
  if (!time) return '';
  const [hoursRaw, minutes] = time.split(':');
  const hours = Number(hoursRaw);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${minutes} ${suffix}`;
}

export function timeToMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  if (Number.isNaN(diff)) return '';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

export function getClass(data, section) {
  return data?.classes?.find((cls) => cls.id === section) || null;
}

export function classLabel(data, section) {
  return getClass(data, section)?.displayName || section;
}

export function getStaff(data, staffId) {
  return data?.staff?.find((member) => member.id === staffId) || null;
}

export function getStudent(data, studentId) {
  return data?.students?.find((student) => student.id === studentId) || null;
}

export function getSubjectsForTeacher(data, staffId) {
  return (data?.subjects || []).filter((subject) => subject.assignedStaffId === staffId);
}

export function getTeacherClasses(data, staffId) {
  if (!data) return [];
  const classIds = new Set();
  data.subjects
    ?.filter((subject) => subject.assignedStaffId === staffId)
    .forEach((subject) => classIds.add(subject.classIdSection));
  data.timetable
    ?.filter((period) => period.teacherStaffId === staffId)
    .forEach((period) => classIds.add(period.classIdSection));
  data.classIncharges
    ?.filter((incharge) => incharge.activeStaffId === staffId)
    .forEach((incharge) => classIds.add(incharge.classIdSection));

  return (data.classes || [])
    .filter((cls) => classIds.has(cls.id))
    .map((cls) => ({
      ...cls,
      isIncharge: data.classIncharges?.some(
        (incharge) =>
          incharge.classIdSection === cls.id && incharge.activeStaffId === staffId
      ),
      mySubjects: (data.subjects || []).filter(
        (subject) =>
          subject.classIdSection === cls.id && subject.assignedStaffId === staffId
      ),
    }));
}

export function getInchargeClasses(data, staffId) {
  return getTeacherClasses(data, staffId).filter((cls) => cls.isIncharge);
}

export function attendanceStats(entries = []) {
  const counts = { present: 0, absent: 0, late: 0, excused: 0 };
  entries.forEach((entry) => {
    if (counts[entry.status] !== undefined) counts[entry.status] += 1;
  });
  const total = entries.length;
  const effective = counts.present + counts.late * 0.5;
  return {
    ...counts,
    total,
    rate: total ? Math.round((effective / total) * 1000) / 10 : 0,
    marked: total,
  };
}

export function findSession(data, section, date, sessionType = 'Morning') {
  return (
    data?.attendanceSessions?.find(
      (session) =>
        session.classIdSection === section &&
        session.date === date &&
        session.sessionType === sessionType
    ) || null
  );
}

export function sessionsForStudent(data, studentId) {
  return (data?.attendanceSessions || []).filter((session) =>
    session.entries?.some((entry) => entry.studentId === studentId)
  );
}

export function studentAttendance(data, studentId) {
  const sessions = sessionsForStudent(data, studentId);
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;
  sessions.forEach((session) => {
    const entry = session.entries.find((item) => item.studentId === studentId);
    if (!entry) return;
    if (entry.status === 'present') present += 1;
    if (entry.status === 'absent') absent += 1;
    if (entry.status === 'late') late += 1;
    if (entry.status === 'excused') excused += 1;
  });
  const total = present + absent + late + excused;
  const rate = total ? Math.round(((present + late * 0.5) / total) * 1000) / 10 : 0;
  return { present, absent, late, excused, total, rate, sessions };
}

export function studentScores(data, studentId) {
  return (data?.testRecords || [])
    .filter((record) => record.studentId === studentId)
    .sort((a, b) => new Date(b.enteredAt) - new Date(a.enteredAt));
}

export function studentAverage(data, studentId) {
  const scores = studentScores(data, studentId);
  if (!scores.length) return null;
  return Math.round((scores.reduce((sum, record) => sum + record.percentage, 0) / scores.length) * 10) / 10;
}

export function isStudentAtRisk(data, studentId) {
  const scores = studentScores(data, studentId);
  if (!scores.length) return false;
  const average = scores.reduce((sum, record) => sum + record.percentage, 0) / scores.length;
  return average < 35 || (scores.length >= 2 && scores[0].percentage < 35);
}

export function overallAttendanceForDate(data, date) {
  const sessions = (data?.attendanceSessions || []).filter((session) => session.date === date);
  const entries = sessions.flatMap((session) => session.entries || []);
  return attendanceStats(entries);
}

export function examEffectiveStatus(exam, now = new Date()) {
  if (!exam) return 'Upcoming';
  if (['Submitted', 'Locked'].includes(exam.marksStatus)) return exam.marksStatus;
  const end = new Date(`${exam.date}T${exam.endTime || '23:59'}:00`);
  return now > end ? 'Open' : 'Upcoming';
}

export function examRemainingTime(exam) {
  const end = new Date(`${exam.date}T${exam.endTime || '23:59'}:00`);
  const start = new Date(`${exam.date}T${exam.startTime || '00:00'}:00`);
  return { start, end };
}

export function categoryLabel(category) {
  const labels = {
    classTest: 'Class Test',
    ca1: 'CA-1',
    ca2: 'CA-2',
    midTerm: 'Mid-Term',
    endTerm: 'End-Term',
  };
  return labels[category] || category;
}

export function attendanceMeta(status) {
  return (
    {
      present: { label: 'Present', short: 'P', tone: 'success' },
      absent: { label: 'Absent', short: 'A', tone: 'danger' },
      late: { label: 'Late', short: 'L', tone: 'warning' },
      excused: { label: 'Excused', short: 'E', tone: 'info' },
    }[status] || { label: status, short: '?', tone: 'neutral' }
  );
}

export function rmsMeta(category) {
  return (
    {
      leave: { label: 'Leave request', short: 'Leave' },
      maintenance: { label: 'Maintenance', short: 'Maintenance' },
      gear: { label: 'Equipment / gear', short: 'Gear' },
      confidential: { label: 'Confidential', short: 'Confidential' },
      general: { label: 'General request', short: 'General' },
    }[category] || { label: category, short: category }
  );
}

export function rmsStatusMeta(status) {
  return (
    {
      pending: { label: 'Pending review', tone: 'warning' },
      underReview: { label: 'Under review', tone: 'info' },
      approved: { label: 'Approved', tone: 'success' },
      rejected: { label: 'Declined', tone: 'danger' },
      resolved: { label: 'Resolved', tone: 'success' },
    }[status] || { label: status, tone: 'neutral' }
  );
}

export function priorityTone(importance) {
  return (
    {
      Normal: 'neutral',
      Important: 'info',
      Urgent: 'warning',
      Emergency: 'danger',
    }[importance] || 'neutral'
  );
}

export function nextSchoolDayIndex(date = new Date()) {
  const day = date.getDay();
  return day >= 1 && day <= 5 ? day : 1;
}

export function weekDates(anchor = new Date()) {
  const day = anchor.getDay();
  const monday = new Date(anchor);
  const diff = day === 0 ? -6 : 1 - day;
  monday.setDate(anchor.getDate() + diff);
  return [0, 1, 2, 3, 4].map((offset) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + offset);
    return date;
  });
}

export function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadCsv(fileName, headers, rows) {
  const content = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
