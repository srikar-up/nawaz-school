import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarCheck2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  GraduationCap,
  Inbox,
  Megaphone,
  Plus,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { GroupedBarChart } from '../components/Charts';
import {
  attendanceStats,
  classLabel,
  examEffectiveStatus,
  findSession,
  formatDate,
  formatDateLong,
  formatTime,
  greeting,
  importanceTone,
  isStudentAtRisk,
  overallAttendanceForDate,
  relativeTime,
  schoolDaysBack,
  studentAttendance,
  studentAverage,
  todayISO,
} from '../lib/format';
import { getTimetableConfig } from '../lib/timetable';

function classTone(index) {
  return ['lavender', 'yellow', 'mint', 'rose'][index % 4];
}

export default function Overview() {
  const { data, user } = useAppData();
  const today = todayISO();
  const timetableConfig = getTimetableConfig(data);
  const calendarDay = new Date().getDay();
  const activeDay = timetableConfig.days.includes(calendarDay)
    ? calendarDay
    : timetableConfig.days[0];
  const attendance = overallAttendanceForDate(data, today);
  const teachers = data.staff.filter(
    (member) => member.isActive && member.accessLevel === 'TeacherApp'
  );
  const atRisk = data.students
    .filter((student) => isStudentAtRisk(data, student.id))
    .map((student) => ({
      ...student,
      average: studentAverage(data, student.id),
      attendance: studentAttendance(data, student.id),
    }))
    .sort((a, b) => (a.average || 0) - (b.average || 0));
  const pendingRequests = data.rmsTickets.filter((ticket) => ticket.status === 'pending');
  const openExams = data.exams.filter((exam) => examEffectiveStatus(exam) === 'Open');
  const submittedClasses = data.classes.filter((cls) =>
    findSession(data, cls.id, today)
  );
  const classRows = data.classes.map((cls, index) => {
    const session = findSession(data, cls.id, today);
    const stats = session ? attendanceStats(session.entries) : null;
    const incharge = data.staff.find(
      (member) =>
        member.id ===
        data.classIncharges.find((entry) => entry.classIdSection === cls.id)?.activeStaffId
    );
    return { cls, session, stats, incharge, tone: classTone(index) };
  });
  const trendDays = schoolDaysBack(7).map((date) => {
    const dayStats = overallAttendanceForDate(data, date);
    const dateObj = new Date(`${date}T12:00:00`);
    return {
      label: dateObj.toLocaleDateString('en-GB', { weekday: 'short' }),
      present: dayStats.present,
      absent: dayStats.absent + dayStats.late + dayStats.excused,
      rate: dayStats.rate,
    };
  });
  const attendanceSpark = trendDays.map((day) => day.rate);
  const agendaPeriods = data.timetable
    .filter((period) => period.classIdSection === '10-A' && period.dayOfWeek === activeDay)
    .sort((a, b) => a.periodNumber - b.periodNumber)
    .slice(0, 4);
  const announcements = [...data.announcements]
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .slice(0, 3);
  const activities = data.activities.slice(0, 4);
  const avgScore = data.testRecords.length
    ? Math.round(
        (data.testRecords.reduce((sum, record) => sum + record.percentage, 0) /
          data.testRecords.length) *
          10
      ) / 10
    : 0;

  const moduleTiles = [
    {
      to: '/students',
      icon: Users,
      title: 'Students',
      description: 'Rosters, guardians & records',
      meta: `${data.students.length} enrolled`,
      tone: 'lavender',
    },
    {
      to: '/attendance',
      icon: CalendarCheck2,
      title: 'Attendance',
      description: 'Daily registers & class oversight',
      meta: `${submittedClasses.length}/${data.classes.length} submitted`,
      tone: 'mint',
    },
    {
      to: '/staff',
      icon: GraduationCap,
      title: 'Teachers',
      description: 'Staff directory & access levels',
      meta: `${teachers.length} teaching`,
      tone: 'yellow',
    },
    {
      to: '/classes',
      icon: BookOpenCheck,
      title: 'Classes & subjects',
      description: 'Subject allocation & timetable',
      meta: `${data.subjects.length} subjects`,
      tone: 'sky',
    },
    {
      to: '/exams',
      icon: ClipboardCheck,
      title: 'Exams & marks',
      description: 'Assessments and result matrices',
      meta: `${openExams.length} open now`,
      tone: 'rose',
    },
    {
      to: '/announcements',
      icon: Megaphone,
      title: 'Announcements',
      description: 'School-wide communication',
      meta: `${data.announcements.length} notices`,
      tone: 'peach',
    },
    {
      to: '/requests',
      icon: Inbox,
      title: 'Requests & leave',
      description: 'Staff requests and approvals',
      meta: `${pendingRequests.length} pending`,
      tone: 'teal',
    },
    {
      to: '/reports',
      icon: BarChart3,
      title: 'Reports',
      description: 'School performance & trends',
      meta: 'Executive view',
      tone: 'slate',
    },
  ];

  return (
    <div className="admin-page overview-page">
      <PageHeader
        eyebrow={`${formatDateLong(new Date())} · ${data.meta.academicYear}`}
        title={`${greeting()}, ${user.name.replace(/^Dr\.\s*/, '').split(' ')[0]}.`}
        subtitle="Here is what is happening across the school today."
        actions={
          <>
            <Link to="/students?add=1" className="admin-btn admin-btn-secondary">
              <Plus size={16} /> Add student
            </Link>
            <Link to="/announcements" className="admin-btn admin-btn-primary">
              <Megaphone size={16} /> Publish announcement
            </Link>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard
          label="Total students"
          value={data.students.length}
          icon={Users}
          tone="lavender"
          trend={`${data.classes.length} sections`}
          hint="Across Grades 9 and 10"
          sparkline={data.classes.map(
            (cls) => data.students.filter((student) => student.classIdSection === cls.id).length
          )}
          sparkColor="#4338CA"
        />
        <StatCard
          label="Active teachers"
          value={teachers.length}
          icon={GraduationCap}
          tone="yellow"
          trend={`${data.staff.filter((member) => member.isActive).length} total staff`}
          hint="Teaching accounts enabled"
        />
        <StatCard
          label="Attendance today"
          value={`${attendance.rate}%`}
          icon={CalendarCheck2}
          tone="mint"
          trend={`${submittedClasses.length}/${data.classes.length} registers`}
          trendDirection="up"
          hint={`${attendance.present} present · ${attendance.absent} absent`}
          sparkline={attendanceSpark}
          sparkColor="#0D9488"
        />
        <StatCard
          label="Students at risk"
          value={atRisk.length}
          icon={TriangleAlert}
          tone="rose"
          trend={atRisk.length ? 'Needs support' : 'All clear'}
          trendDirection={atRisk.length ? 'down' : 'up'}
          hint={`School mean ${avgScore}%`}
        />
      </div>

      <section className="overview-section">
        <div className="overview-section-head">
          <div>
            <span className="admin-eyebrow">Launchpad</span>
            <h2>School tools</h2>
          </div>
          <span className="overview-section-hint">
            <Sparkles size={14} /> Large targets, plain language
          </span>
        </div>
        <div className="module-grid">
          {moduleTiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link key={tile.to} to={tile.to} className={`module-tile tone-${tile.tone}`}>
                <span className="module-tile-icon">
                  <Icon size={22} />
                </span>
                <div className="module-tile-text">
                  <strong>{tile.title}</strong>
                  <span>{tile.description}</span>
                </div>
                <span className="module-tile-meta">{tile.meta}</span>
                <ChevronRight size={16} className="module-tile-arrow" />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="overview-grid">
        <section className="admin-card overview-chart-card">
          <div className="admin-card-head">
            <div>
              <h2>Attendance trend</h2>
              <p>Present and absent students over the last seven school days</p>
            </div>
            <div className="admin-card-head-stat">
              <strong>{attendance.rate}%</strong>
              <span>today</span>
            </div>
          </div>
          <div className="chart-filter-row">
            <span className="chart-chip active">All grades</span>
            <span className="chart-chip">This week</span>
            <span className="chart-legend-inline">
              <i style={{ background: '#4338CA' }} /> Present
              <i style={{ background: '#FACC15' }} /> Absent / leave
            </span>
          </div>
          <GroupedBarChart
            data={trendDays}
            series={[
              { key: 'present', label: 'Present', color: '#4338CA' },
              { key: 'absent', label: 'Absent / leave', color: '#FACC15' },
            ]}
            maxValue={Math.ceil(
              Math.max(20, ...trendDays.map((day) => Math.max(day.present, day.absent))) / 10
            ) * 10}
            height={250}
            ariaLabel="Attendance trend for the last seven school days"
          />
        </section>

        <section className="admin-card agenda-card">
          <div className="admin-card-head">
            <div>
              <h2>Today at school</h2>
              <p>{formatDate(today)} · Class 10-A schedule</p>
            </div>
            <Link to="/timetable?class=10-A" className="admin-ghost-link">
              Timetable <ArrowRight size={14} />
            </Link>
          </div>
          <div className="agenda-list">
            {agendaPeriods.map((period, index) => (
              <div key={period.id} className="agenda-row">
                <div className="agenda-time">
                  <strong>{formatTime(period.startTime).replace(' ', '')}</strong>
                  <span>{formatTime(period.endTime).replace(' ', '')}</span>
                </div>
                <span className={`agenda-line tone-${classTone(index)}`} />
                <div className="agenda-info">
                  <strong>{period.subject}</strong>
                  <span>
                    {classLabel(data, period.classIdSection)} · {period.room}
                  </span>
                </div>
                <span className="agenda-period">P{period.periodNumber}</span>
              </div>
            ))}
          </div>
          <div className="agenda-foot">
            <span>
              <Clock3 size={14} /> {agendaPeriods.length} periods before lunch
            </span>
            <Link to="/classes" className="admin-ghost-link">
              Class details <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        <section className="admin-card class-register-card">
          <div className="admin-card-head">
            <div>
              <h2>Class registers</h2>
              <p>Today's attendance status by section</p>
            </div>
            <Link to="/attendance" className="admin-ghost-link">
              Open attendance <ArrowRight size={14} />
            </Link>
          </div>
          <div className="class-register-list">
            {classRows.map(({ cls, session, stats, incharge }) => (
              <div key={cls.id} className="class-register-row">
                <span className="class-register-badge">{cls.id}</span>
                <div className="class-register-info">
                  <strong>{cls.displayName}</strong>
                  <span>
                    <Users size={12} /> {cls.studentCount} students · {incharge?.name || 'No incharge'}
                  </span>
                </div>
                <div className="class-register-bar-wrap">
                  <div className="class-register-bar">
                    <i style={{ width: `${stats?.rate || 0}%` }} />
                  </div>
                  <span>{stats ? `${stats.rate}%` : '—'}</span>
                </div>
                <Badge tone={session ? 'success' : 'warning'} dot>
                  {session ? 'Submitted' : 'Waiting'}
                </Badge>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card at-risk-panel">
          <div className="admin-card-head">
            <div>
              <h2>Risk radar</h2>
              <p>Students below the 35% assessment threshold</p>
            </div>
            <Link to="/reports" className="admin-ghost-link">
              Full report <ArrowRight size={14} />
            </Link>
          </div>
          {atRisk.length ? (
            <div className="risk-list">
              {atRisk.slice(0, 4).map((student) => (
                <Link
                  key={student.id}
                  to={`/students?student=${student.id}`}
                  className="risk-row"
                >
                  <Avatar name={student.name} size={36} photo={student.photo} />
                  <span className="risk-name">
                    <strong>{student.name}</strong>
                    <small>
                      {classLabel(data, student.classIdSection)} · {student.attendance.rate}% attendance
                    </small>
                  </span>
                  <span className="risk-score">
                    {student.average !== null ? `${Math.round(student.average)}%` : '—'}
                    <small>average</small>
                  </span>
                  <ChevronRight size={15} />
                </Link>
              ))}
            </div>
          ) : (
            <div className="admin-positive">
              <Sparkles size={20} />
              <div>
                <strong>All students are above the risk line</strong>
                <span>Keep an eye on the reports page for future changes.</span>
              </div>
            </div>
          )}
          <div className="risk-foot">
            <span>
              <TriangleAlert size={13} /> Risk is calculated from recent assessment averages.
            </span>
            <Link to="/exams" className="admin-ghost-link">
              Exams <ChevronRight size={14} />
            </Link>
          </div>
        </section>

        <section className="admin-card announcements-panel">
          <div className="admin-card-head">
            <div>
              <h2>Recent announcements</h2>
              <p>What the school community has been told</p>
            </div>
            <Link to="/announcements" className="admin-ghost-link">
              Manage <ArrowRight size={14} />
            </Link>
          </div>
          <div className="overview-announcements">
            {announcements.map((notice) => (
              <Link key={notice.id} to="/announcements" className="overview-notice">
                <div>
                  <Badge tone={importanceTone(notice.importance)}>{notice.importance}</Badge>
                  <span className="overview-notice-time">{relativeTime(notice.createdAt)}</span>
                </div>
                <strong>{notice.title}</strong>
                <p>{notice.body}</p>
                <span className="overview-notice-author">
                  {notice.publisherName} · {notice.audience}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="admin-card activity-panel">
          <div className="admin-card-head">
            <div>
              <h2>Recent activity</h2>
              <p>Audit trail from the shared school cache</p>
            </div>
            <span className="live-mini-badge">
              <span /> live
            </span>
          </div>
          <div className="activity-list">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-row">
                <span className="activity-dot" />
                <div>
                  <strong>{activity.actorName}</strong>
                  <span>{activity.action}</span>
                  <small>{activity.detail}</small>
                </div>
                <time>{relativeTime(activity.createdAt)}</time>
              </div>
            ))}
          </div>
          <div className="activity-foot">
            <ClipboardList size={13} /> Every important change is recorded in the activity log.
          </div>
        </section>
      </div>
    </div>
  );
}
