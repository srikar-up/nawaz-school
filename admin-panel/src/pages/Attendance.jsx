import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Save,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Drawer from '../components/Drawer';
import EmptyState from '../components/EmptyState';
import PageHeader from '../components/PageHeader';
import { LineChart } from '../components/Charts';
import {
  addDaysISO,
  attendanceStats,
  classLabel,
  compareRoll,
  downloadCsv,
  findSession,
  formatDate,
  formatDateLong,
  formatTime,
  relativeTime,
  schoolDaysBack,
  todayISO,
} from '../lib/format';
import {
  attendanceModeOf,
  primarySessionType,
  sessionTypeLabel,
  sessionTypesFor,
} from '../lib/attendance';

const STATUSES = ['present', 'absent', 'late', 'excused'];
const STATUS_LABELS = { present: 'Present', absent: 'Absent', late: 'Late', excused: 'Excused' };

export default function Attendance() {
  const { data, user, notify, refresh } = useAppData();
  const [searchParams] = useSearchParams();
  const queryDate = searchParams.get('date');
  const queryClass = searchParams.get('class');
  const initialDate =
    queryDate && /^\d{4}-\d{2}-\d{2}$/.test(queryDate) ? queryDate : todayISO();
  const [date, setDate] = useState(initialDate);
  const [reviewClassId, setReviewClassId] = useState(
    data.classes.some((cls) => cls.id === queryClass) ? queryClass : null
  );
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const mode = attendanceModeOf(data.meta);
  const sessionTypes = useMemo(() => sessionTypesFor(mode), [mode]);
  const [sessionType, setSessionType] = useState(() => primarySessionType(mode));

  // Keep the selected register valid if the school switches mode while open.
  useEffect(() => {
    if (!sessionTypes.includes(sessionType)) setSessionType(sessionTypes[0]);
  }, [sessionTypes, sessionType]);

  const sessions = useMemo(
    () =>
      data.attendanceSessions.filter(
        (session) => session.date === date && session.sessionType === sessionType
      ),
    [data.attendanceSessions, date, sessionType]
  );
  const dayStats = attendanceStats(sessions.flatMap((session) => session.entries || []));
  const classRows = data.classes.map((cls) => {
    const session = findSession(data, cls.id, date, sessionType);
    const stats = session ? attendanceStats(session.entries) : null;
    const inchargeId = data.classIncharges.find(
      (entry) => entry.classIdSection === cls.id
    )?.activeStaffId;
    const incharge = data.staff.find((member) => member.id === inchargeId);
    return { cls, session, stats, incharge };
  });
  const submitted = classRows.filter((row) => row.session);
  const reviewClass = classRows.find((row) => row.cls.id === reviewClassId) || null;
  const reviewRoster = reviewClass
    ? data.students
        .filter((student) => student.classIdSection === reviewClass.cls.id)
        .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber))
    : [];

  useEffect(() => {
    if (!reviewClass) return;
    const session = findSession(data, reviewClass.cls.id, date, sessionType);
    const map = {};
    reviewRoster.forEach((student) => {
      const entry = session?.entries.find((item) => item.studentId === student.id);
      map[student.id] = entry?.status || 'present';
    });
    setDraft(map);
  }, [reviewClassId, date, sessionType, data.attendanceSessions.length, reviewRoster.length]);

  const draftStats = attendanceStats(
    reviewRoster.map((student) => ({ status: draft[student.id] || 'present' }))
  );

  const trend = schoolDaysBack(7).map((day) => {
    const entries = data.attendanceSessions
      .filter((session) => session.date === day && session.sessionType === sessionType)
      .flatMap((session) => session.entries || []);
    const stats = attendanceStats(entries);
    return {
      label: new Date(`${day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short' }),
      value: stats.rate,
    };
  });

  const save = async () => {
    if (!reviewClass) return;
    setSaving(true);
    try {
      await api.saveAttendance(user.id, {
        classIdSection: reviewClass.cls.id,
        date,
        sessionType,
        entries: reviewRoster.map((student) => ({
          studentId: student.id,
          status: draft[student.id] || 'present',
        })),
      });
      await refresh({ silent: true });
      notify(
        `Attendance updated for ${reviewClass.cls.displayName} on ${formatDate(date)}.`,
        'success'
      );
      setReviewClassId(null);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportDay = () => {
    const rows = [];
    classRows.forEach(({ cls, session }) => {
      data.students
        .filter((student) => student.classIdSection === cls.id)
        .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber))
        .forEach((student) => {
          const entry = session?.entries.find((item) => item.studentId === student.id);
          rows.push([
            cls.id,
            student.rollNumber,
            student.name,
            entry ? STATUS_LABELS[entry.status] : 'Not marked',
            entry?.remarks || '',
          ]);
        });
    });
    downloadCsv(
      `nawaz-attendance-${date}.csv`,
      ['Class', 'Roll', 'Student', 'Status', 'Remarks'],
      rows
    );
    notify('Attendance CSV downloaded.', 'success');
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Daily oversight"
        title="Attendance"
        subtitle="See which class registers are in, review exceptions and correct records when needed."
        actions={
          <div className="attendance-head-actions">
            <Link to="/attendance/registry" className="admin-btn admin-btn-secondary">
              <CalendarDays size={16} /> Monthly registry
            </Link>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={exportDay}>
              <Download size={16} /> Export day
            </button>
          </div>
        }
      />

      <div className="attendance-toolbar-card">
        <div className="date-stepper">
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => setDate(addDaysISO(date, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          <label className="date-stepper-input">
            <CalendarDays size={16} />
            <input type="date" value={date} max={todayISO()} onChange={(event) => setDate(event.target.value)} />
          </label>
          <button
            type="button"
            className="admin-icon-btn"
            onClick={() => setDate(addDaysISO(date, 1))}
            disabled={date >= todayISO()}
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
          {date !== todayISO() ? (
            <button type="button" className="admin-chip-button" onClick={() => setDate(todayISO())}>
              Jump to today
            </button>
          ) : (
            <Badge tone="brand" dot>
              Today · {formatDateLong(date, { year: undefined })}
            </Badge>
          )}
        </div>
        <div className="attendance-toolbar-note">
          <Clock3 size={14} />
          <span>
            {sessionTypeLabel(sessionType)} register · {formatDate(date)}
          </span>
          <Badge tone={submitted.length === data.classes.length ? 'success' : 'warning'}>
            {submitted.length}/{data.classes.length} submitted
          </Badge>
        </div>
      </div>

      <div className="attendance-session-bar">
        <span className="attendance-session-label">Register</span>
        <div className="admin-session-switch" role="group" aria-label="Attendance session">
          {sessionTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={sessionType === type ? 'active' : ''}
              aria-pressed={sessionType === type}
              onClick={() => setSessionType(type)}
            >
              {sessionTypeLabel(type)}
            </button>
          ))}
        </div>
        <span className="attendance-session-hint">
          {mode === 'fullDay'
            ? 'One register covers the whole day.'
            : 'Morning and afternoon are tracked separately.'}
        </span>
      </div>

      <div className="mini-stat-row">
        <div className="mini-stat">
          <span>Overall rate</span>
          <strong>{dayStats.rate}%</strong>
          <small>{dayStats.total} entries</small>
        </div>
        <div className="mini-stat success">
          <span>Present</span>
          <strong>{dayStats.present}</strong>
          <small>on time</small>
        </div>
        <div className="mini-stat danger">
          <span>Absent</span>
          <strong>{dayStats.absent}</strong>
          <small>needs follow-up</small>
        </div>
        <div className="mini-stat warning">
          <span>Late</span>
          <strong>{dayStats.late}</strong>
          <small>arrived late</small>
        </div>
        <div className="mini-stat info">
          <span>Excused</span>
          <strong>{dayStats.excused}</strong>
          <small>approved leave</small>
        </div>
      </div>

      <div className="attendance-layout">
        <section className="attendance-class-section">
          <div className="admin-section-head">
            <div>
              <h2>Class registers</h2>
              <p>Open a class to review or correct the daily roll-call.</p>
            </div>
            {submitted.length < data.classes.length ? (
              <span className="admin-inline-alert">
                <TriangleAlert size={14} />
                {data.classes.length - submitted.length} waiting
              </span>
            ) : (
              <Badge tone="success" icon={Check}>All registers in</Badge>
            )}
          </div>

          <div className="attendance-class-grid">
            {classRows.map(({ cls, session, stats, incharge }) => (
              <article key={cls.id} className={`attendance-class-card ${session ? '' : 'waiting'}`}>
                <div className="attendance-class-top">
                  <span className="class-id-badge">{cls.id}</span>
                  <Badge tone={session ? 'success' : 'warning'} dot>
                    {session ? 'Submitted' : 'Waiting'}
                  </Badge>
                </div>
                <h3>{cls.displayName}</h3>
                <p>
                  <Users size={13} /> {cls.studentCount} students · Incharge {incharge?.name || 'Unassigned'}
                </p>
                <div className="attendance-class-stats">
                  <div>
                    <span>Present</span>
                    <strong>{stats?.present ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Absent</span>
                    <strong>{stats?.absent ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Late</span>
                    <strong>{stats?.late ?? '—'}</strong>
                  </div>
                  <div>
                    <span>Excused</span>
                    <strong>{stats?.excused ?? '—'}</strong>
                  </div>
                </div>
                <div className="attendance-class-rate">
                  <div className="attendance-progress">
                    <i style={{ width: `${stats?.rate || 0}%` }} />
                  </div>
                  <strong>{stats ? `${stats.rate}%` : '—'}</strong>
                </div>
                <div className="attendance-class-foot">
                  <span>
                    {session
                      ? `Submitted ${relativeTime(session.submittedAt)}`
                      : 'No register submitted yet'}
                  </span>
                  <button
                    type="button"
                    className="admin-text-button"
                    onClick={() => setReviewClassId(cls.id)}
                  >
                    {session ? 'Review register' : 'Take register'} <ArrowRight size={14} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="attendance-aside">
          <section className="admin-card attendance-trend-card">
            <div className="admin-card-head">
              <div>
                <h2>Weekly trend</h2>
                <p>School attendance rate</p>
              </div>
              <Badge tone="brand">{trend[trend.length - 1]?.value}%</Badge>
            </div>
            <LineChart
              data={trend}
              height={190}
              maxValue={100}
              color="#0D9488"
              suffix="%"
              ariaLabel="Weekly attendance rate"
            />
          </section>

          <section className="admin-card submission-tracker">
            <div className="admin-card-head">
              <div>
                <h2>Submission tracker</h2>
                <p>{sessionTypeLabel(sessionType)} registers for {formatDate(date)}</p>
              </div>
            </div>
            <div className="tracker-list">
              {classRows.map(({ cls, session, stats }) => (
                <div key={cls.id} className="tracker-row">
                  <span className={`tracker-icon ${session ? 'done' : 'waiting'}`}>
                    {session ? <Check size={14} /> : <Clock3 size={14} />}
                  </span>
                  <span>
                    <strong>{cls.displayName}</strong>
                    <small>{stats ? `${stats.rate}% · ${stats.present} present` : 'Waiting for incharge'}</small>
                  </span>
                  <Badge tone={session ? 'success' : 'warning'}>
                    {session ? 'In' : 'Due'}
                  </Badge>
                </div>
              ))}
            </div>
          </section>

          <section className="admin-card attendance-note-card">
            <TriangleAlert size={18} />
            <div>
              <strong>Exception follow-up</strong>
              <p>
                {dayStats.absent + dayStats.late} students are absent or late today. Use the student
                directory to check attendance history before contacting guardians.
              </p>
            </div>
          </section>
        </aside>
      </div>

      <Drawer
        open={Boolean(reviewClass)}
        title={reviewClass ? `${reviewClass.cls.displayName} · ${sessionTypeLabel(sessionType)} register` : 'Register'}
        subtitle={reviewClass ? `${formatDate(date)} · ${reviewClass.incharge?.name || 'No incharge'}` : ''}
        onClose={() => setReviewClassId(null)}
        width={540}
        footer={
          <div className="drawer-footer-actions">
            <div className="drawer-save-info">
              <span>Current draft</span>
              <strong>{draftStats.present}/{draftStats.total} present</strong>
            </div>
            <button type="button" className="admin-btn admin-btn-primary" onClick={save} disabled={saving}>
              {saving ? <span className="admin-spinner" /> : <Save size={16} />}
              {saving ? 'Saving…' : 'Save & sync'}
            </button>
          </div>
        }
      >
        {reviewClass ? (
          <div className="register-review">
            <div className="register-summary">
              <div>
                <span>Present</span>
                <strong>{draftStats.present}</strong>
              </div>
              <div>
                <span>Absent</span>
                <strong>{draftStats.absent}</strong>
              </div>
              <div>
                <span>Late</span>
                <strong>{draftStats.late}</strong>
              </div>
              <div>
                <span>Excused</span>
                <strong>{draftStats.excused}</strong>
              </div>
              <div className="register-summary-rate">
                <span>Rate</span>
                <strong>{draftStats.rate}%</strong>
              </div>
            </div>

            <div className="register-review-toolbar">
              <span>{reviewRoster.length} students on the roster</span>
              <button
                type="button"
                className="admin-btn admin-btn-secondary admin-btn-sm"
                onClick={() =>
                  setDraft(Object.fromEntries(reviewRoster.map((student) => [student.id, 'present'])))
                }
              >
                <CheckCheck size={15} /> Mark all present
              </button>
            </div>

            <div className="register-student-list">
              {reviewRoster.map((student) => {
                const status = draft[student.id] || 'present';
                const entry = reviewClass.session?.entries.find(
                  (item) => item.studentId === student.id
                );
                return (
                  <div key={student.id} className="register-student-row">
                    <div className="register-student-info">
                      <Avatar name={student.name} size={34} photo={student.photo} />
                      <span>
                        <strong>{student.name}</strong>
                        <small>
                          Roll {student.rollNumber}
                          {entry?.remarks ? ` · ${entry.remarks}` : ''}
                        </small>
                      </span>
                    </div>
                    <div className="admin-status-switch">
                      {STATUSES.map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={`${option} ${status === option ? 'active' : ''}`}
                          onClick={() =>
                            setDraft((current) => ({ ...current, [student.id]: option }))
                          }
                        >
                          {STATUS_LABELS[option]}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
