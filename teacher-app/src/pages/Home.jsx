import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  BookOpen,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileBarChart2,
  GraduationCap,
  Megaphone,
  Plus,
  Sparkles,
  TriangleAlert,
  Users,
  MapPin,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import ProgressRing from '../components/ProgressRing';
import {
  attendanceStats,
  classLabel,
  examEffectiveStatus,
  findSession,
  formatDateLong,
  formatTime,
  greeting,
  isStudentAtRisk,
  priorityTone,
  relativeTime,
  studentScores,
  timeToMinutes,
  todayISO,
} from '../lib/format';
import { getTimetableConfig } from '../lib/timetable';
import {
  attendanceModeOf,
  primarySessionType,
  sessionTypeLabel,
} from '../lib/attendance';

function scheduleForTeacher(data, staffId, day) {
  return data.timetable
    .filter((period) => period.teacherStaffId === staffId && period.dayOfWeek === day)
    .sort((a, b) => a.periodNumber - b.periodNumber);
}

export default function Home() {
  const { data, user } = useAppData();
  const teacherClasses = data.classes.filter((cls) => {
    const teaches = data.timetable.some(
      (period) => period.classIdSection === cls.id && period.teacherStaffId === user.id
    );
    const incharge = data.classIncharges.some(
      (entry) => entry.classIdSection === cls.id && entry.activeStaffId === user.id
    );
    const subject = data.subjects.some(
      (entry) => entry.classIdSection === cls.id && entry.assignedStaffId === user.id
    );
    return teaches || incharge || subject;
  });
  const primaryClass =
    teacherClasses.find((cls) =>
      data.classIncharges.some(
        (entry) => entry.classIdSection === cls.id && entry.activeStaffId === user.id
      )
    ) || teacherClasses[0];
  const today = todayISO();
  const now = new Date();
  const timetableConfig = getTimetableConfig(data);
  const isSchoolDay = timetableConfig.days.includes(now.getDay());
  const activeDay = isSchoolDay ? now.getDay() : timetableConfig.days[0];
  const periods = scheduleForTeacher(data, user.id, activeDay);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentPeriod = isSchoolDay
    ? periods.find(
        (period) =>
          nowMinutes >= timeToMinutes(period.startTime) &&
          nowMinutes <= timeToMinutes(period.endTime)
      )
    : null;
  const nextPeriod = isSchoolDay
    ? periods.find((period) => timeToMinutes(period.startTime) > nowMinutes)
    : periods[0];
  const daySessionType = primarySessionType(attendanceModeOf(data.meta));
  const session = primaryClass
    ? findSession(data, primaryClass.id, today, daySessionType)
    : null;
  const stats = session ? attendanceStats(session.entries) : null;
  const primaryRoster = primaryClass
    ? data.students.filter((student) => student.classIdSection === primaryClass.id)
    : [];
  const atRisk = teacherClasses
    .flatMap((cls) =>
      data.students
        .filter((student) => student.classIdSection === cls.id)
        .filter((student) => isStudentAtRisk(data, student.id))
        .map((student) => ({ ...student, className: cls.displayName }))
    )
    .slice(0, 3);
  const announcements = [...data.announcements]
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 3);
  const urgentNotice = announcements.find(
    (notice) =>
      notice.importance === 'Urgent' ||
      notice.importance === 'Emergency' ||
      notice.isPinned
  );
  const openExams = data.exams.filter(
    (exam) =>
      exam.assignedStaffId === user.id && examEffectiveStatus(exam) === 'Open'
  );
  const teacherClassIds = new Set(teacherClasses.map((cls) => cls.id));
  const assignmentsDue = data.assignments.filter(
    (assignment) =>
      teacherClassIds.has(assignment.classIdSection) &&
      assignment.status !== 'Reviewed' &&
      assignment.dueDate >= today
  );
  const latestScores = primaryRoster
    .flatMap((student) => studentScores(data, student.id))
    .sort((a, b) => new Date(b.enteredAt) - new Date(a.enteredAt));

  const dateLabel = `${greeting()},`;
  const displayPeriods = (
    periods.length
      ? periods
      : scheduleForTeacher(data, user.id, timetableConfig.days[0])
  ).slice(0, 3);

  return (
    <div className="t-page home-page">
      <section className="home-hero">
        <div className="home-hero-decor home-hero-decor-a" aria-hidden="true" />
        <div className="home-hero-decor home-hero-decor-b" aria-hidden="true" />
        <div className="hero-top">
          <div className="hero-identity">
            <Avatar name={user.name} size={46} className="avatar-hero" photo={user.photo} />
            <div>
              <span className="hero-greeting">{dateLabel}</span>
              <h2>{user.name.replace(/^Prof\.\s*/, '')}</h2>
            </div>
          </div>
          <Link to="/notices" className="hero-icon-btn" aria-label="Notices">
            <Bell size={19} />
            <span className="dot" />
          </Link>
        </div>

        <div className="hero-meta">
          <span className="hero-chip">
            <GraduationCap size={14} />
            {primaryClass?.displayName || 'Teacher'} · Incharge
          </span>
          <span className="hero-date">{formatDateLong(now, { year: 'numeric' })}</span>
        </div>

        <div className="hero-stats">
          <div className="hero-stat hero-stat-yellow">
            <span className="hero-stat-label">Attendance today</span>
            <strong>{stats ? `${stats.rate}%` : '—'}</strong>
            <small>
              {stats ? `${stats.present} of ${stats.total} present` : 'Roll-call not started'}
            </small>
          </div>
          <div className="hero-stat hero-stat-glass">
            <span className="hero-stat-label">{isSchoolDay ? 'Next class' : 'First class'}</span>
            <strong>{nextPeriod ? formatTime(nextPeriod.startTime).replace(' ', '') : '—'}</strong>
            <small>
              {nextPeriod ? `${nextPeriod.subject} · ${nextPeriod.room}` : 'No classes scheduled'}
            </small>
          </div>
        </div>

        <Link to="/attendance" className="hero-action">
          <CalendarCheck2 size={18} />
          {stats ? 'Review today’s attendance' : 'Take attendance now'}
          <ArrowRight size={17} />
        </Link>
      </section>

      <section className="quick-actions" aria-label="Quick actions">
        <Link to="/attendance" className="quick-action qa-indigo">
          <span className="quick-action-icon">
            <CalendarCheck2 size={21} />
          </span>
          <span>
            <strong>Attendance</strong>
            <small>Mark the register</small>
          </span>
        </Link>
        <Link to="/tasks?compose=assignment" className="quick-action qa-amber">
          <span className="quick-action-icon">
            <Plus size={21} />
          </span>
          <span>
            <strong>New task</strong>
            <small>Set an assignment</small>
          </span>
        </Link>
        <Link to="/timetable" className="quick-action qa-teal">
          <span className="quick-action-icon">
            <CalendarDays size={21} />
          </span>
          <span>
            <strong>Timetable</strong>
            <small>See the whole week</small>
          </span>
        </Link>
        <Link to="/reports" className="quick-action qa-blue">
          <span className="quick-action-icon">
            <FileBarChart2 size={21} />
          </span>
          <span>
            <strong>Reports</strong>
            <small>Student progress</small>
          </span>
        </Link>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">{isSchoolDay ? 'Today' : 'Next school day'}</span>
            <h2>Your schedule</h2>
          </div>
          <Link to="/timetable" className="text-link">
            Full week <ChevronRight size={15} />
          </Link>
        </div>
        <div className="schedule-list">
          {displayPeriods.length ? (
            displayPeriods.map((period) => {
              const isNow = currentPeriod?.id === period.id;
              const isNext = !isNow && nextPeriod?.id === period.id;
              return (
                <article
                  key={period.id}
                  className={`schedule-card ${isNow ? 'schedule-now' : ''}`}
                >
                  <div className="schedule-time">
                    <strong>{formatTime(period.startTime).replace(' ', '')}</strong>
                    <span>{formatTime(period.endTime).replace(' ', '')}</span>
                  </div>
                  <div className="schedule-rail">
                    <span className="schedule-dot" />
                  </div>
                  <div className="schedule-content">
                    <div className="schedule-title-row">
                      <h3>{period.subject}</h3>
                      {isNow ? (
                        <Badge tone="success" icon={Sparkles}>
                          Now
                        </Badge>
                      ) : isNext ? (
                        <Badge tone="brand">Next</Badge>
                      ) : null}
                    </div>
                    <div className="schedule-meta">
                      <span>{classLabel(data, period.classIdSection)}</span>
                      <span>
                        <MapPin size={12} /> {period.room}
                      </span>
                      {period.isLab ? <span className="lab-tag">Lab</span> : null}
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="soft-empty">No periods scheduled for this day.</div>
          )}
        </div>
      </section>

      {urgentNotice ? (
        <Link to="/notices" className="notice-banner">
          <span className="notice-banner-icon">
            <Megaphone size={19} />
          </span>
          <span className="notice-banner-text">
            <small>{urgentNotice.importance} · {relativeTime(urgentNotice.createdAt)}</small>
            <strong>{urgentNotice.title}</strong>
          </span>
          <ChevronRight size={18} />
        </Link>
      ) : null}

      <div className="home-columns">
        <section className="card attendance-preview">
          <div className="card-top">
            <div>
              <span className="eyebrow">Class overview</span>
              <h2>{primaryClass?.displayName || 'Your class'}</h2>
            </div>
            <Link to="/attendance" className="icon-btn" aria-label="Open attendance">
              <ArrowRight size={18} />
            </Link>
          </div>
          <div className="attendance-preview-body">
            <ProgressRing
              value={stats?.rate || 0}
              size={108}
              stroke={10}
              color="var(--brand)"
              track="var(--brand-100)"
            >
              <strong>{stats ? `${Math.round(stats.rate)}%` : '—'}</strong>
              <span>present</span>
            </ProgressRing>
            <div className="attendance-preview-stats">
              <div>
                <span className="legend-dot success" />
                <span>Present</span>
                <strong>{stats?.present ?? '—'}</strong>
              </div>
              <div>
                <span className="legend-dot danger" />
                <span>Absent</span>
                <strong>{stats?.absent ?? '—'}</strong>
              </div>
              <div>
                <span className="legend-dot warning" />
                <span>Late</span>
                <strong>{stats?.late ?? '—'}</strong>
              </div>
              <div>
                <span className="legend-dot info" />
                <span>Excused</span>
                <strong>{stats?.excused ?? '—'}</strong>
              </div>
            </div>
          </div>
          <div className="attendance-preview-foot">
            <span>
              {session
                ? `Submitted ${relativeTime(session.submittedAt)}`
                : `${sessionTypeLabel(daySessionType)} register is waiting`}
            </span>
            <Link to="/attendance" className="text-link">
              {session ? 'Edit register' : 'Start roll-call'} <ChevronRight size={15} />
            </Link>
          </div>
        </section>

        <section className="card at-risk-card">
          <div className="card-top">
            <div>
              <span className="eyebrow">Early warning</span>
              <h2>Needs attention</h2>
            </div>
            <span className="icon-bubble rose">
              <TriangleAlert size={18} />
            </span>
          </div>
          {atRisk.length ? (
            <div className="at-risk-list">
              {atRisk.map((student) => (
                <Link
                  key={student.id}
                  to={`/reports?student=${student.id}`}
                  className="at-risk-row"
                >
                  <Avatar name={student.name} size={34} photo={student.photo} />
                  <span>
                    <strong>{student.name}</strong>
                    <small>{student.className} · below 35% average</small>
                  </span>
                  <ChevronRight size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="positive-state">
              <CheckCircle2 size={22} />
              <div>
                <strong>Everyone is on track</strong>
                <span>No students are currently below the risk threshold.</span>
              </div>
            </div>
          )}
          <Link to="/reports" className="card-link">
            Open student reports <ChevronRight size={15} />
          </Link>
        </section>
      </div>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Waiting for you</span>
            <h2>Work in progress</h2>
          </div>
          <Link to="/tasks" className="text-link">
            Open tasks <ChevronRight size={15} />
          </Link>
        </div>
        <div className="work-grid">
          <Link to="/tasks?tab=exams" className="work-card">
            <span className="work-icon indigo">
              <ClipboardList size={20} />
            </span>
            <span>
              <strong>{openExams.length}</strong>
              <small>exam {openExams.length === 1 ? 'awaiting marks' : 'awaiting marks'}</small>
            </span>
          </Link>
          <Link to="/tasks?tab=assignments" className="work-card">
            <span className="work-icon amber">
              <BookOpen size={20} />
            </span>
            <span>
              <strong>{assignmentsDue.length}</strong>
              <small>active assignments</small>
            </span>
          </Link>
          <Link to="/syllabus" className="work-card">
            <span className="work-icon teal">
              <GraduationCap size={20} />
            </span>
            <span>
              <strong>
                {data.subjects
                  .filter((subject) => subject.assignedStaffId === user.id)
                  .length}
              </strong>
              <small>subjects to track</small>
            </span>
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <div>
            <span className="eyebrow">Notice board</span>
            <h2>Latest updates</h2>
          </div>
          <Link to="/notices" className="text-link">
            View all <ChevronRight size={15} />
          </Link>
        </div>
        <div className="notice-list">
          {announcements.map((notice) => (
            <Link to="/notices" key={notice.id} className="notice-card">
              <div className="notice-card-top">
                <Badge tone={priorityTone(notice.importance)}>{notice.importance}</Badge>
                <span>{relativeTime(notice.createdAt)}</span>
              </div>
              <h3>{notice.title}</h3>
              <p>{notice.body}</p>
              <div className="notice-card-foot">
                <span>
                  <Users size={13} /> {notice.audience}
                </span>
                <span>{notice.publisherName}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="data-footnote">
        <Clock3 size={13} /> {latestScores.length} recent scores · data syncs live with the
        admin console
      </p>
    </div>
  );
}
