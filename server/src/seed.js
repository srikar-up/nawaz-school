/**
 * Seed data for the Nawaz School prototype.
 *
 * This is deliberately a single school, one academic year, realistic enough to
 * exercise every screen. It is generated relative to "today" so that today's
 * timetable, attendance and exams always look live.
 */

import { upcomingSundayISO } from './timetable.js';

const SCHEMA_VERSION = 1;

const pad = (n) => String(n).padStart(2, '0');

const isoDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const atTime = (date, hours, minutes = 0) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hours,
    minutes,
    0,
    0
  ).toISOString();

const nowIso = () => new Date().toISOString();

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function random01(text) {
  return (hash(text) % 10000) / 10000;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const FIRST_NAMES = [
  'Ahmed',
  'Ayesha',
  'Ali',
  'Fatima',
  'Bilal',
  'Hira',
  'Daniyal',
  'Iman',
  'Faizan',
  'Jannat',
  'Hamza',
  'Khadija',
  'Hassan',
  'Laiba',
  'Ibrahim',
  'Mahnoor',
  'Junaid',
  'Maryam',
  'Kamran',
  'Mishal',
  'Muhammad',
  'Noor',
  'Omair',
  'Rida',
  'Rayan',
  'Sana',
  'Saad',
  'Sidra',
  'Talha',
  'Warda',
  'Usman',
  'Zainab',
  'Zain',
  'Aleena',
  'Abdullah',
  'Hadia',
  'Areeb',
  'Rameen',
  'Haris',
  'Saira',
];

const LAST_NAMES = [
  'Khan',
  'Ahmed',
  'Malik',
  'Raza',
  'Iqbal',
  'Sheikh',
  'Butt',
  'Chaudhry',
  'Qureshi',
  'Siddiqui',
  'Farooq',
  'Abbasi',
  'Nawaz',
  'Hussain',
  'Javed',
  'Mirza',
  'Rashid',
  'Saleem',
  'Tariq',
  'Yousaf',
];

const STAFF = [
  {
    id: 'STF-001',
    code: 'STF-001',
    name: 'Dr. Tariq Nawaz',
    email: 'admin@nawazschool.edu',
    phone: '+92 300 1112233',
    staffType: 'Principal',
    department: 'Administration',
    accessLevel: 'SuperAdmin',
    isActive: true,
    joinedOn: '2014-04-01',
    avatarColor: '#4338CA',
  },
  {
    id: 'STF-002',
    code: 'STF-002',
    name: 'Prof. Sarah Nawaz',
    email: 'teacher@nawazschool.edu',
    phone: '+92 300 1234567',
    staffType: 'Teacher',
    department: 'Science & Mathematics',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: '2016-08-15',
    avatarColor: '#0D9488',
  },
  {
    id: 'STF-003',
    code: 'STF-003',
    name: 'Dr. Imran Khan',
    email: 'imran@nawazschool.edu',
    phone: '+92 301 4455667',
    staffType: 'Teacher',
    department: 'Physics',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: '2018-01-10',
    avatarColor: '#1D4ED8',
  },
  {
    id: 'STF-004',
    code: 'STF-004',
    name: 'Ms. Ayesha Siddiqa',
    email: 'ayesha@nawazschool.edu',
    phone: '+92 302 7788990',
    staffType: 'Teacher',
    department: 'English & Literature',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: '2017-03-22',
    avatarColor: '#B45309',
  },
  {
    id: 'STF-005',
    code: 'STF-005',
    name: 'Mr. Bilal Siddiqui',
    email: 'bilal@nawazschool.edu',
    phone: '+92 303 2233445',
    staffType: 'Teacher',
    department: 'Computer Science',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: '2019-08-01',
    avatarColor: '#7C3AED',
  },
  {
    id: 'STF-006',
    code: 'STF-006',
    name: 'Ms. Hina Raza',
    email: 'hina@nawazschool.edu',
    phone: '+92 304 5566778',
    staffType: 'Teacher',
    department: 'Chemistry',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: '2018-09-05',
    avatarColor: '#BE185D',
  },
  {
    id: 'STF-007',
    code: 'STF-007',
    name: 'Mr. Usman Ali',
    email: 'subadmin@nawazschool.edu',
    phone: '+92 305 8899001',
    staffType: 'Operator',
    department: 'Operations',
    accessLevel: 'SubAdmin',
    isActive: true,
    joinedOn: '2020-02-17',
    avatarColor: '#0F766E',
  },
  {
    id: 'STF-008',
    code: 'STF-008',
    name: 'Mr. Rashid Mehmood',
    email: 'rashid@nawazschool.edu',
    phone: '+92 306 1122334',
    staffType: 'Electrician',
    department: 'Facilities',
    accessLevel: 'NoAccess',
    isActive: true,
    joinedOn: '2021-06-11',
    avatarColor: '#475569',
  },
  {
    id: 'STF-009',
    code: 'STF-009',
    name: 'Mr. Abdul Rehman',
    email: 'abdul@nawazschool.edu',
    phone: '+92 307 3344556',
    staffType: 'Bus Driver',
    department: 'Transport',
    accessLevel: 'NoAccess',
    isActive: true,
    joinedOn: '2022-01-04',
    avatarColor: '#92400E',
  },
  {
    id: 'STF-010',
    code: 'STF-010',
    name: 'Ms. Sana Iqbal',
    email: 'sana@nawazschool.edu',
    phone: '+92 308 6677889',
    staffType: 'Teacher',
    department: 'Urdu',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: '2019-04-18',
    avatarColor: '#0369A1',
  },
  {
    id: 'STF-011',
    code: 'STF-011',
    name: 'Mr. Faisal Ahmed',
    email: 'faisal@nawazschool.edu',
    phone: '+92 309 9900112',
    staffType: 'Support Staff',
    department: 'Facilities',
    accessLevel: 'NoAccess',
    isActive: true,
    joinedOn: '2023-07-20',
    avatarColor: '#334155',
  },
  {
    id: 'STF-012',
    code: 'STF-012',
    name: 'Ms. Zainab Fatima',
    email: 'zainab@nawazschool.edu',
    phone: '+92 310 1122445',
    staffType: 'Teacher',
    department: 'Biology',
    accessLevel: 'TeacherApp',
    isActive: true,
    joinedOn: '2020-08-24',
    avatarColor: '#15803D',
  },
];

const CLASS_SEEDS = [
  {
    id: '10-A',
    gradeLevel: '10',
    section: 'A',
    displayName: 'Class 10-A',
    room: 'Room 204',
    classTeacherId: 'STF-002',
  },
  {
    id: '10-B',
    gradeLevel: '10',
    section: 'B',
    displayName: 'Class 10-B',
    room: 'Room 205',
    classTeacherId: 'STF-003',
  },
  {
    id: '9-A',
    gradeLevel: '9',
    section: 'A',
    displayName: 'Class 9-A',
    room: 'Room 106',
    classTeacherId: 'STF-004',
  },
  {
    id: '9-B',
    gradeLevel: '9',
    section: 'B',
    displayName: 'Class 9-B',
    room: 'Room 107',
    classTeacherId: 'STF-005',
  },
];

const CHAPTERS = {
  Mathematics: [
    'Quadratic Equations',
    'Arithmetic Progression',
    'Coordinate Geometry',
    'Introduction to Trigonometry',
    'Circles',
    'Statistics',
    'Probability',
    'Surface Areas & Volumes',
  ],
  Physics: [
    'Motion',
    'Force & Laws of Motion',
    'Gravitation',
    'Work & Energy',
    'Sound',
    'Light — Reflection',
    'Light — Refraction',
    'Electricity',
    'Magnetic Effects',
  ],
  Chemistry: [
    'Chemical Reactions',
    'Acids, Bases & Salts',
    'Metals & Non-Metals',
    'Carbon Compounds',
    'Periodic Classification',
    'Life Processes',
  ],
  English: [
    'Prose — A Letter to God',
    'Poetry — Dust of Snow',
    'Grammar — Tenses',
    'Writing — Formal Letter',
    'Prose — Nelson Mandela',
    'Poetry — Fire and Ice',
  ],
  'Computer Science': [
    'HTML Foundations',
    'CSS Styling',
    'JavaScript Basics',
    'Data Types & Variables',
    'Control Flow',
    'Mini Project — Portfolio',
  ],
  Biology: [
    'Life Processes',
    'Control & Coordination',
    'Reproduction',
    'Heredity',
    'Our Environment',
  ],
  'General Science': [
    'Matter in Our Surroundings',
    'Atoms & Molecules',
    'Motion',
    'Force & Laws',
    'Gravitation',
    'Sound',
  ],
  Urdu: [
    'Nazm — Hamd',
    'Ghazal — Mirza Ghalib',
    'Nasar — Overcoat',
    'Qawaid',
    'Mazmoon Nigari',
    'Khatoot Nigari',
  ],
};

const SUBJECT_PLAN = {
  '10-A': [
    { code: 'MATH-10', name: 'Mathematics', teacher: 'STF-002' },
    { code: 'PHY-10', name: 'Physics', teacher: 'STF-002', lab: true },
    { code: 'CHEM-10', name: 'Chemistry', teacher: 'STF-006', lab: true },
    { code: 'ENG-10', name: 'English', teacher: 'STF-004' },
    { code: 'CS-10', name: 'Computer Science', teacher: 'STF-005', lab: true },
    { code: 'BIO-10', name: 'Biology', teacher: 'STF-012', lab: true },
  ],
  '10-B': [
    { code: 'MATH-10', name: 'Mathematics', teacher: 'STF-003' },
    { code: 'PHY-10', name: 'Physics', teacher: 'STF-003', lab: true },
    { code: 'CHEM-10', name: 'Chemistry', teacher: 'STF-006', lab: true },
    { code: 'ENG-10', name: 'English', teacher: 'STF-004' },
    { code: 'CS-10', name: 'Computer Science', teacher: 'STF-005', lab: true },
    { code: 'BIO-10', name: 'Biology', teacher: 'STF-012', lab: true },
  ],
  '9-A': [
    { code: 'MATH-9', name: 'Mathematics', teacher: 'STF-002' },
    { code: 'GSCI-9', name: 'General Science', teacher: 'STF-003', lab: true },
    { code: 'ENG-9', name: 'English', teacher: 'STF-004' },
    { code: 'CS-9', name: 'Computer Science', teacher: 'STF-005', lab: true },
    { code: 'URDU-9', name: 'Urdu', teacher: 'STF-010' },
    { code: 'CHEM-9', name: 'Chemistry', teacher: 'STF-006', lab: true },
  ],
  '9-B': [
    { code: 'MATH-9', name: 'Mathematics', teacher: 'STF-004' },
    { code: 'GSCI-9', name: 'General Science', teacher: 'STF-003', lab: true },
    { code: 'ENG-9', name: 'English', teacher: 'STF-004' },
    { code: 'CS-9', name: 'Computer Science', teacher: 'STF-005', lab: true },
    { code: 'URDU-9', name: 'Urdu', teacher: 'STF-010' },
    { code: 'CHEM-9', name: 'Chemistry', teacher: 'STF-006', lab: true },
  ],
};

const PERIODS = [
  { periodNumber: 1, startTime: '08:30', endTime: '09:15' },
  { periodNumber: 2, startTime: '09:20', endTime: '10:05' },
  { periodNumber: 3, startTime: '10:15', endTime: '11:00' },
  { periodNumber: 4, startTime: '11:05', endTime: '11:50' },
  { periodNumber: 5, startTime: '12:30', endTime: '13:15' },
  { periodNumber: 6, startTime: '13:20', endTime: '14:05' },
];

const SCHOOL_DAYS = [1, 2, 3, 4, 5];

function makeStudents() {
  const students = [];
  CLASS_SEEDS.forEach((cls, classIndex) => {
    const usedNames = new Set();
    for (let i = 0; i < 14; i += 1) {
      let first = FIRST_NAMES[(classIndex * 7 + i * 3) % FIRST_NAMES.length];
      let last = LAST_NAMES[(classIndex * 5 + i * 2) % LAST_NAMES.length];
      let attempts = 0;
      while (usedNames.has(`${first} ${last}`)) {
        last = LAST_NAMES[(classIndex * 5 + i * 2 + attempts + 1) % LAST_NAMES.length];
        attempts += 1;
      }
      usedNames.add(`${first} ${last}`);

      const roll = pad(i + 1);
      const id = `STU-${cls.id.replace('-', '')}-${roll}`;
      const code = `STU-${cls.id.replace('-', '')}-${roll}`;
      const female = FIRST_NAMES.indexOf(first) % 2 === 1;
      const parentFirst = female ? 'Mr.' : 'Mrs.';
      const parentName = `${parentFirst} ${LAST_NAMES[(classIndex * 3 + i) % LAST_NAMES.length]}`;
      const birthYear = 2011 - Number(cls.gradeLevel) + 10;

      students.push({
        id,
        code,
        rollNumber: roll,
        name: `${first} ${last}`,
        classIdSection: cls.id,
        guardianName: parentName,
        parentPhone: `+92 3${(classIndex + 1) % 10}0 ${1000000 + classIndex * 13000 + i * 317}`,
        gender: female ? 'Female' : 'Male',
        dateOfBirth: `${birthYear}-${pad(((i * 3) % 12) + 1)}-${pad(((i * 5) % 27) + 1)}`,
        address: `House ${12 + i}, Street ${3 + (i % 9)}, Model Town, Lahore`,
        admissionDate: `${birthYear + 5}-04-15`,
        status: 'Active',
        createdAt: new Date(birthYear + 5, 3, 15).toISOString(),
      });
    }
  });
  return students;
}

function makeSubjects() {
  const subjects = [];
  CLASS_SEEDS.forEach((cls, classIndex) => {
    SUBJECT_PLAN[cls.id].forEach((plan, subjectIndex) => {
      const chapterNames = CHAPTERS[plan.name] || CHAPTERS.Mathematics;
      const chapters = chapterNames.map((title, chapterIndex) => {
        const marker = (chapterIndex + subjectIndex + classIndex) % 6;
        const status =
          marker <= 1 ? 'completed' : marker === 2 ? 'in_progress' : 'pending';
        return { title, status };
      });
      const teacher = STAFF.find((s) => s.id === plan.teacher);
      subjects.push({
        id: `sub-${cls.id.toLowerCase()}-${plan.code.toLowerCase()}`,
        subjectCode: plan.code,
        subjectName: plan.name,
        classIdSection: cls.id,
        assignedStaffId: plan.teacher,
        assignedTeacherName: teacher ? teacher.name : 'Unassigned',
        isLab: Boolean(plan.lab),
        chapters,
        updatedAt: nowIso(),
      });
    });
  });
  return subjects;
}

function makeTimetable(subjects) {
  const periods = [];
  const teacherBusy = new Set();

  SCHOOL_DAYS.forEach((day) => {
    PERIODS.forEach((period, periodIndex) => {
      const classesThisPeriod = [...CLASS_SEEDS];
      classesThisPeriod.forEach((cls, classIndex) => {
        const offerings = subjects.filter((s) => s.classIdSection === cls.id);
        const usedToday = new Set(
          periods
            .filter((p) => p.classIdSection === cls.id && p.dayOfWeek === day)
            .map((p) => p.subjectId)
        );
        const startIndex = (periodIndex + day + classIndex) % offerings.length;
        const rotated = [
          ...offerings.slice(startIndex),
          ...offerings.slice(0, startIndex),
        ];
        const free = rotated.find(
          (s) => !teacherBusy.has(`${day}-${period.periodNumber}-${s.assignedStaffId}`)
        );
        const fresh = rotated.find(
          (s) =>
            !usedToday.has(s.id) &&
            !teacherBusy.has(`${day}-${period.periodNumber}-${s.assignedStaffId}`)
        );
        const chosen = fresh || free || rotated[0];
        teacherBusy.add(`${day}-${period.periodNumber}-${chosen.assignedStaffId}`);
        const teacher = STAFF.find((s) => s.id === chosen.assignedStaffId);

        periods.push({
          id: `TT-${cls.id}-D${day}-P${period.periodNumber}`,
          classIdSection: cls.id,
          className: cls.displayName,
          subjectId: chosen.id,
          subjectCode: chosen.subjectCode,
          subject: chosen.subjectName,
          teacherStaffId: chosen.assignedStaffId,
          teacherName: teacher ? teacher.name : chosen.assignedTeacherName,
          dayOfWeek: day,
          dayName: WEEKDAY_NAMES[day],
          periodNumber: period.periodNumber,
          startTime: period.startTime,
          endTime: period.endTime,
          room: chosen.isLab ? `Lab ${cls.section === 'A' ? 'Alpha' : 'Beta'}` : cls.room,
          isLab: Boolean(chosen.isLab),
        });
      });
    });
  });

  return periods;
}

const TODAY = new Date();
const TODAY_ISO = isoDate(TODAY);
const currentDay = TODAY.getDay();
const displayDay = currentDay >= 1 && currentDay <= 5 ? currentDay : 1;

function makeAttendance(students) {
  const sessions = [];
  const reasonPool = {
    absent: [
      'Family emergency — informed by guardian',
      'Unexcused absence',
      'Medical appointment',
    ],
    late: ['Transport / bus delay', 'Arrived after assembly'],
    excused: ['Medical leave', 'School activity / sports', 'Family emergency'],
  };

  const schoolDates = [];
  let cursor = new Date(TODAY);
  while (schoolDates.length < 24) {
    const dow = cursor.getDay();
    if (dow >= 1 && dow <= 5) schoolDates.unshift(new Date(cursor));
    cursor = addDays(cursor, -1);
  }

  schoolDates.forEach((date, dateIndex) => {
    const dateStr = isoDate(date);
    const isToday = dateStr === TODAY_ISO;

    CLASS_SEEDS.forEach((cls) => {
      if (isToday && cls.id === '9-B') return; // deliberately pending for admin demo

      const roster = students.filter((s) => s.classIdSection === cls.id);
      const incharge = cls.id === '10-B' ? 'STF-003' : cls.id === '9-B' ? 'STF-004' : 'STF-002';
      const entries = roster.map((student, index) => {
        const atRisk = index === 3 || index === 9 || index === 12;
        const r = random01(`${dateStr}-${cls.id}-${student.id}`);
        let status = 'present';
        if (atRisk) {
          if (r < 0.1) status = 'absent';
          else if (r < 0.16) status = 'late';
          else if (r < 0.19) status = 'excused';
        } else if (r < 0.04) {
          status = 'absent';
        } else if (r < 0.07) {
          status = 'late';
        } else if (r < 0.085) {
          status = 'excused';
        }

        let remarks = '';
        if (status !== 'present') {
          const pool = reasonPool[status];
          remarks = pool[hash(`${student.id}-${dateStr}`) % pool.length];
        }

        return { studentId: student.id, status, remarks };
      });

      sessions.push({
        id: `ATT-${cls.id}-${dateStr}-Morning`,
        classIdSection: cls.id,
        date: dateStr,
        dayOfWeek: WEEKDAY_NAMES[date.getDay()],
        sessionType: 'Morning',
        periodNumber: null,
        submittedByStaffId: incharge,
        submittedAt: atTime(date, 8, 55),
        entries,
      });
    });
  });

  return sessions;
}

function makeStaffAttendance() {
  const records = [];
  const todayStatus = {
    'STF-001': 'Present',
    'STF-002': 'Present',
    'STF-003': 'Present',
    'STF-004': 'Present',
    'STF-005': 'On Leave',
    'STF-006': 'Present',
    'STF-007': 'Present',
    'STF-008': 'Present',
    'STF-009': 'Present',
    'STF-010': 'Present',
    'STF-011': 'Absent',
    'STF-012': 'Present',
  };

  for (let back = 0; back < 5; back += 1) {
    const date = addDays(TODAY, -back);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    STAFF.forEach((staff) => {
      const status = back === 0 ? todayStatus[staff.id] : 'Present';
      records.push({
        id: `SA-${isoDate(date).replaceAll('-', '')}-${staff.id}`,
        staffId: staff.id,
        staffName: staff.name,
        date: isoDate(date),
        checkInTime: status === 'Present' ? '08:05' : status === 'On Leave' ? '' : '',
        checkOutTime: status === 'Present' ? '14:20' : '',
        status,
        leaveReason: status === 'On Leave' ? 'Approved casual leave' : '',
      });
    });
  }
  return records;
}

function makeExams() {
  const date = (offset) => isoDate(addDays(TODAY, offset));
  return [
    {
      id: 'EXM-001',
      title: 'Mathematics CA-1',
      classIdSection: '10-A',
      subjectId: 'sub-10-a-math-10',
      subject: 'Mathematics',
      category: 'ca1',
      date: date(-21),
      startTime: '09:20',
      endTime: '10:05',
      maxMarks: 50,
      assignedStaffId: 'STF-002',
      marksStatus: 'Submitted',
      createdAt: atTime(addDays(TODAY, -30), 10, 0),
      submittedAt: atTime(addDays(TODAY, -21), 13, 10),
    },
    {
      id: 'EXM-002',
      title: 'Physics Mid-Term',
      classIdSection: '10-A',
      subjectId: 'sub-10-a-phy-10',
      subject: 'Physics',
      category: 'midTerm',
      date: date(-1),
      startTime: '09:20',
      endTime: '11:00',
      maxMarks: 100,
      assignedStaffId: 'STF-002',
      marksStatus: 'Upcoming',
      createdAt: atTime(addDays(TODAY, -14), 9, 30),
      submittedAt: null,
    },
    {
      id: 'EXM-003',
      title: 'Mathematics End-Term',
      classIdSection: '10-A',
      subjectId: 'sub-10-a-math-10',
      subject: 'Mathematics',
      category: 'endTerm',
      date: date(10),
      startTime: '08:30',
      endTime: '10:30',
      maxMarks: 100,
      assignedStaffId: 'STF-002',
      marksStatus: 'Upcoming',
      createdAt: atTime(addDays(TODAY, -2), 11, 0),
      submittedAt: null,
    },
    {
      id: 'EXM-004',
      title: 'Mathematics CA-1',
      classIdSection: '9-A',
      subjectId: 'sub-9-a-math-9',
      subject: 'Mathematics',
      category: 'ca1',
      date: date(-14),
      startTime: '10:15',
      endTime: '11:00',
      maxMarks: 25,
      assignedStaffId: 'STF-002',
      marksStatus: 'Submitted',
      createdAt: atTime(addDays(TODAY, -24), 10, 0),
      submittedAt: atTime(addDays(TODAY, -14), 15, 20),
    },
    {
      id: 'EXM-005',
      title: 'Chemistry CA-2',
      classIdSection: '10-A',
      subjectId: 'sub-10-a-chem-10',
      subject: 'Chemistry',
      category: 'ca2',
      date: date(-2),
      startTime: '11:05',
      endTime: '11:50',
      maxMarks: 25,
      assignedStaffId: 'STF-006',
      marksStatus: 'Upcoming',
      createdAt: atTime(addDays(TODAY, -12), 12, 0),
      submittedAt: null,
    },
    {
      id: 'EXM-006',
      title: 'Physics Mid-Term',
      classIdSection: '10-B',
      subjectId: 'sub-10-b-phy-10',
      subject: 'Physics',
      category: 'midTerm',
      date: date(3),
      startTime: '09:20',
      endTime: '11:00',
      maxMarks: 100,
      assignedStaffId: 'STF-003',
      marksStatus: 'Upcoming',
      createdAt: atTime(addDays(TODAY, -1), 9, 0),
      submittedAt: null,
    },
    {
      id: 'EXM-007',
      title: 'English CA-1',
      classIdSection: '10-A',
      subjectId: 'sub-10-a-eng-10',
      subject: 'English',
      category: 'ca1',
      date: date(-10),
      startTime: '08:30',
      endTime: '09:15',
      maxMarks: 30,
      assignedStaffId: 'STF-004',
      marksStatus: 'Submitted',
      createdAt: atTime(addDays(TODAY, -18), 10, 0),
      submittedAt: atTime(addDays(TODAY, -10), 14, 0),
    },
    {
      id: 'EXM-008',
      title: 'General Science CA-1',
      classIdSection: '9-A',
      subjectId: 'sub-9-a-gsci-9',
      subject: 'General Science',
      category: 'ca1',
      date: date(-7),
      startTime: '09:20',
      endTime: '10:05',
      maxMarks: 30,
      assignedStaffId: 'STF-003',
      marksStatus: 'Submitted',
      createdAt: atTime(addDays(TODAY, -15), 8, 0),
      submittedAt: atTime(addDays(TODAY, -7), 13, 0),
    },
    {
      id: 'EXM-009',
      title: 'Mathematics CA-2',
      classIdSection: '10-A',
      subjectId: 'sub-10-a-math-10',
      subject: 'Mathematics',
      category: 'ca2',
      date: date(4),
      startTime: '10:15',
      endTime: '11:00',
      maxMarks: 50,
      assignedStaffId: 'STF-002',
      marksStatus: 'Upcoming',
      createdAt: atTime(TODAY, 8, 10),
      submittedAt: null,
    },
  ];
}

const SCORE_BANDS = [
  0.88, 0.76, 0.94, 0.62, 0.82, 0.71, 0.55, 0.91, 0.68, 0.28, 0.84, 0.73,
  0.31, 0.9,
];

function makeTestRecords(exams, students) {
  const records = [];
  const submitted = exams.filter((exam) => exam.marksStatus === 'Submitted');
  submitted.forEach((exam, examIndex) => {
    const roster = students.filter((s) => s.classIdSection === exam.classIdSection);
    roster.forEach((student, index) => {
      const ratio = SCORE_BANDS[(index + examIndex * 3) % SCORE_BANDS.length];
      const marksObtained = Math.round(exam.maxMarks * ratio);
      const record = {
        id: `TR-${exam.id}-${student.id}`,
        examId: exam.id,
        examTitle: exam.title,
        studentId: student.id,
        studentName: student.name,
        classIdSection: exam.classIdSection,
        subject: exam.subject,
        category: exam.category,
        marksObtained,
        maxMarks: exam.maxMarks,
        percentage: Math.round((marksObtained / exam.maxMarks) * 1000) / 10,
        enteredByStaffId: exam.assignedStaffId,
        enteredAt: exam.submittedAt || nowIso(),
      };
      records.push(record);
    });
  });
  return records;
}

function makeAssignments() {
  const date = (offset) => isoDate(addDays(TODAY, offset));
  return [
    {
      id: 'ASG-001',
      title: 'Quadratic Equations — Practice Set 4',
      description:
        'Solve exercises 4.1 to 4.4. Show all working steps and bring the notebook to the next class.',
      classIdSection: '10-A',
      subject: 'Mathematics',
      dueDate: date(2),
      status: 'Assigned',
      createdByStaffId: 'STF-002',
      createdAt: atTime(addDays(TODAY, -1), 15, 20),
    },
    {
      id: 'ASG-002',
      title: "Lab Report — Ohm's Law",
      description:
        'Submit the complete lab report with circuit diagram, observations and conclusion.',
      classIdSection: '10-A',
      subject: 'Physics',
      dueDate: date(0),
      status: 'Assigned',
      createdByStaffId: 'STF-002',
      createdAt: atTime(addDays(TODAY, -3), 11, 0),
    },
    {
      id: 'ASG-003',
      title: 'Essay — My Village',
      description: 'Write 250–300 words. Focus on descriptive language and paragraph structure.',
      classIdSection: '9-A',
      subject: 'English',
      dueDate: date(4),
      status: 'Assigned',
      createdByStaffId: 'STF-004',
      createdAt: atTime(addDays(TODAY, -2), 10, 45),
    },
    {
      id: 'ASG-004',
      title: 'HTML Portfolio Page',
      description: 'Build a one-page personal portfolio using semantic HTML and a linked stylesheet.',
      classIdSection: '10-A',
      subject: 'Computer Science',
      dueDate: date(7),
      status: 'Assigned',
      createdByStaffId: 'STF-005',
      createdAt: atTime(addDays(TODAY, -1), 9, 0),
    },
    {
      id: 'ASG-005',
      title: 'Trigonometry Worksheet',
      description: 'Complete all 12 problems in the worksheet handed out in class.',
      classIdSection: '10-A',
      subject: 'Mathematics',
      dueDate: date(-3),
      status: 'Reviewed',
      createdByStaffId: 'STF-002',
      createdAt: atTime(addDays(TODAY, -9), 12, 30),
    },
    {
      id: 'ASG-006',
      title: 'Acids & Bases — Lab Prep',
      description: 'Read the practical manual and prepare the observation table before the lab.',
      classIdSection: '10-B',
      subject: 'Chemistry',
      dueDate: date(6),
      status: 'Assigned',
      createdByStaffId: 'STF-006',
      createdAt: atTime(addDays(TODAY, -1), 14, 0),
    },
  ];
}

function makeAnnouncements() {
  const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'ANN-001',
      title: 'Mid-Term Examination Schedule Released',
      body:
        'The mid-term examination schedule for Grades 9 and 10 is now available. Please review your subject dates with your class teacher and begin revision from this week. Exams begin at 08:30 sharp.',
      importance: 'Urgent',
      audience: 'All',
      isPinned: true,
      publisherName: 'Dr. Tariq Nawaz',
      createdAt: hoursAgo(2),
    },
    {
      id: 'ANN-002',
      title: 'Parent–Teacher Meeting — Saturday',
      body:
        'Parents are invited to the term progress meeting this Saturday from 09:00 to 12:30 in the main hall. Class teachers should prepare attendance and assessment summaries for their sections.',
      importance: 'Important',
      audience: 'All',
      isPinned: true,
      publisherName: 'Dr. Tariq Nawaz',
      createdAt: hoursAgo(19),
    },
    {
      id: 'ANN-003',
      title: 'Staff Development Workshop',
      body:
        'A workshop on classroom assessment and feedback will be held on Thursday at 14:30 in the library. All teaching staff are expected to attend.',
      importance: 'Important',
      audience: 'TeachersOnly',
      isPinned: false,
      publisherName: 'Prof. Sarah Nawaz',
      createdAt: hoursAgo(30),
    },
    {
      id: 'ANN-004',
      title: 'Science Fair Registration Open',
      body:
        'Students interested in the annual science fair can register with their science teacher until Friday. Projects may be individual or in teams of two.',
      importance: 'Normal',
      audience: 'All',
      isPinned: false,
      publisherName: 'Ms. Hina Raza',
      createdAt: hoursAgo(52),
    },
    {
      id: 'ANN-005',
      title: 'School Closed on Friday',
      body:
        'Due to scheduled maintenance work on the electrical system, the school will remain closed on Friday. Classes will resume on Monday as usual.',
      importance: 'Emergency',
      audience: 'All',
      isPinned: true,
      publisherName: 'Dr. Tariq Nawaz',
      createdAt: hoursAgo(98),
    },
    {
      id: 'ANN-006',
      title: 'New Books in the Library',
      body:
        'The library has added new reference books for Mathematics, Physics and English. Students may borrow them during break time.',
      importance: 'Normal',
      audience: 'All',
      isPinned: false,
      publisherName: 'Ms. Ayesha Siddiqa',
      createdAt: hoursAgo(140),
    },
  ];
}

function makeRmsTickets() {
  const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'RMS-001',
      ticketNo: 'RMS-2026-001',
      senderStaffId: 'STF-002',
      senderName: 'Prof. Sarah Nawaz',
      senderEmail: 'teacher@nawazschool.edu',
      category: 'maintenance',
      subject: 'Projector in Room 204 flickers',
      body:
        'The ceiling projector in Room 204 flickers during presentations. It has become difficult to show slides in Period 2. Please arrange a check before the mid-term revision week.',
      room: 'Room 204',
      priority: 'High',
      isConfidential: false,
      status: 'pending',
      principalNote: '',
      createdAt: hoursAgo(6),
      resolvedAt: null,
    },
    {
      id: 'RMS-002',
      ticketNo: 'RMS-2026-002',
      senderStaffId: 'STF-002',
      senderName: 'Prof. Sarah Nawaz',
      senderEmail: 'teacher@nawazschool.edu',
      category: 'confidential',
      subject: 'Concern about student workload',
      body:
        'A few Grade 10 students have approached me about the combined workload during mid-terms. I would like to discuss a revised submission plan privately.',
      room: '',
      priority: 'Medium',
      isConfidential: true,
      status: 'underReview',
      principalNote: 'Please come to the office after Period 4 so we can review the schedule together.',
      createdAt: hoursAgo(28),
      resolvedAt: null,
    },
    {
      id: 'RMS-003',
      ticketNo: 'RMS-2026-003',
      senderStaffId: 'STF-003',
      senderName: 'Dr. Imran Khan',
      senderEmail: 'imran@nawazschool.edu',
      category: 'maintenance',
      subject: 'Physics lab exhaust fan not working',
      body:
        'The exhaust fan in Lab Alpha stopped working before the practical class. We had to shorten the experiment. Please have the facilities team inspect it.',
      room: 'Lab Alpha',
      priority: 'High',
      isConfidential: false,
      status: 'underReview',
      principalNote: 'Facilities team notified. Work order assigned to Mr. Rashid.',
      createdAt: hoursAgo(52),
      resolvedAt: null,
    },
    {
      id: 'RMS-004',
      ticketNo: 'RMS-2026-004',
      senderStaffId: 'STF-005',
      senderName: 'Mr. Bilal Siddiqui',
      senderEmail: 'bilal@nawazschool.edu',
      category: 'gear',
      subject: 'Arduino kits for the robotics club',
      body:
        'We need 20 Arduino starter kits and 10 breadboards for the upcoming robotics club sessions. The current kits are shared between two sections and are insufficient.',
      room: 'Computer Lab',
      priority: 'Medium',
      isConfidential: false,
      status: 'pending',
      principalNote: '',
      createdAt: hoursAgo(72),
      resolvedAt: null,
    },
    {
      id: 'RMS-005',
      ticketNo: 'RMS-2026-005',
      senderStaffId: 'STF-006',
      senderName: 'Ms. Hina Raza',
      senderEmail: 'hina@nawazschool.edu',
      category: 'leave',
      subject: 'Casual leave request — Thursday',
      body:
        'I would like to request one day of casual leave on Thursday for a family matter. The Chemistry lab session has been rescheduled with Ms. Zainab.',
      room: '',
      priority: 'Medium',
      isConfidential: false,
      status: 'approved',
      principalNote: 'Approved. Please share the revised lab plan with the coordinator.',
      createdAt: hoursAgo(120),
      resolvedAt: hoursAgo(110),
    },
    {
      id: 'RMS-006',
      ticketNo: 'RMS-2026-006',
      senderStaffId: 'STF-004',
      senderName: 'Ms. Ayesha Siddiqa',
      senderEmail: 'ayesha@nawazschool.edu',
      category: 'maintenance',
      subject: 'Broken benches in Room 106',
      body: 'Three benches in the back row of Room 106 are broken and unsafe for students.',
      room: 'Room 106',
      priority: 'High',
      isConfidential: false,
      status: 'resolved',
      principalNote: 'Benches replaced by the facilities team on Monday.',
      createdAt: hoursAgo(190),
      resolvedAt: hoursAgo(160),
    },
  ];
}

function makeActivities(announcements, tickets) {
  const hoursAgo = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  return [
    {
      id: 'AUD-001',
      actorId: 'STF-002',
      actorName: 'Prof. Sarah Nawaz',
      action: 'Submitted morning attendance',
      entity: 'Attendance',
      entityId: '10-A',
      detail: 'Morning roll-call submitted for Class 10-A',
      createdAt: hoursAgo(1),
    },
    {
      id: 'AUD-002',
      actorId: 'STF-001',
      actorName: 'Dr. Tariq Nawaz',
      action: 'Published announcement',
      entity: 'Announcement',
      entityId: announcements[0]?.id || 'ANN-001',
      detail: announcements[0]?.title || 'Mid-Term Examination Schedule Released',
      createdAt: hoursAgo(2),
    },
    {
      id: 'AUD-003',
      actorId: 'STF-002',
      actorName: 'Prof. Sarah Nawaz',
      action: 'Raised a maintenance request',
      entity: 'Request',
      entityId: tickets[0]?.id || 'RMS-001',
      detail: 'Projector in Room 204 flickers',
      createdAt: hoursAgo(6),
    },
    {
      id: 'AUD-004',
      actorId: 'STF-001',
      actorName: 'Dr. Tariq Nawaz',
      action: 'Approved leave request',
      entity: 'Request',
      entityId: 'RMS-005',
      detail: 'Casual leave approved for Ms. Hina Raza',
      createdAt: hoursAgo(110),
    },
    {
      id: 'AUD-005',
      actorId: 'STF-003',
      actorName: 'Dr. Imran Khan',
      action: 'Updated syllabus progress',
      entity: 'Syllabus',
      entityId: 'sub-10-b-phy-10',
      detail: 'Motion marked as completed',
      createdAt: hoursAgo(26),
    },
  ];
}

export function buildSeed() {
  const students = makeStudents();
  const subjects = makeSubjects();
  const timetable = makeTimetable(subjects);
  const attendanceSessions = makeAttendance(students);
  const exams = makeExams();
  const testRecords = makeTestRecords(exams, students);
  const assignments = makeAssignments();
  const announcements = makeAnnouncements();
  const rmsTickets = makeRmsTickets();
  const activities = makeActivities(announcements, rmsTickets);

  const classes = CLASS_SEEDS.map((cls) => {
    const teacher = STAFF.find((s) => s.id === cls.classTeacherId);
    const roster = students.filter((s) => s.classIdSection === cls.id).length;
    return {
      ...cls,
      classTeacherName: teacher ? teacher.name : '',
      studentCount: roster,
      academicYear: '2026–2027',
    };
  });

  const classIncharges = CLASS_SEEDS.map((cls) => {
    const incharge =
      cls.id === '10-A' || cls.id === '9-A'
        ? 'STF-002'
        : cls.id === '10-B'
          ? 'STF-003'
          : 'STF-004';
    return {
      id: `CI-${cls.id}`,
      classIdSection: cls.id,
      defaultStaffId: incharge,
      activeStaffId: incharge,
      academicYear: '2026–2027',
    };
  });

  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      revision: 1,
      schoolName: 'Nawaz School System',
      shortName: 'Nawaz School',
      tagline: 'Learn. Grow. Lead.',
      academicYear: '2026–2027',
      address: '12-B Model Town, Lahore, Pakistan',
      phone: '+92 42 3577 1200',
      email: 'office@nawazschool.edu',
      principalName: 'Dr. Tariq Nawaz',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      today: TODAY_ISO,
      todayName: WEEKDAY_NAMES[displayDay],
      timetableDays: [...SCHOOL_DAYS],
      timetablePeriods: PERIODS.map((period) => ({ ...period })),
      timetableStatus: 'draft',
      timetableEditUntil: upcomingSundayISO(TODAY),
      timetablePublishedAt: null,
    },
    staff: STAFF,
    classes,
    students,
    subjects,
    timetable,
    exams,
    testRecords,
    assignments,
    attendanceSessions,
    staffAttendance: makeStaffAttendance(),
    classIncharges,
    announcements,
    rmsTickets,
    activities,
  };
}

export { SCHEMA_VERSION };
