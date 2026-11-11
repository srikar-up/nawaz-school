import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Circle,
  Clock3,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import ProgressRing from '../components/ProgressRing';
import Sheet from '../components/Sheet';
import {
  attendanceMeta,
  attendanceStats,
  classLabel,
  compareRoll,
  findSession,
  formatDate,
  formatDateLong,
  formatTime,
  getInchargeClasses,
  relativeTime,
  studentAttendance,
  todayISO,
} from '../lib/format';
import {
  attendanceModeOf,
  primarySessionType,
  sessionTypeLabel,
  sessionTypesFor,
} from '../lib/attendance';

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused'];

const REASONS = [
  { label: 'Sick / fever', status: 'excused', icon: '🤒' },
  { label: 'Medical leave', status: 'excused', icon: '🏥' },
  { label: 'Family emergency', status: 'excused', icon: '🏠' },
  { label: 'Transport / bus delay', status: 'late', icon: '🚌' },
  { label: 'Unexcused absence', status: 'absent', icon: '⚠️' },
  { label: 'School activity / sports', status: 'excused', icon: '🏅' },
];

function emptyEntries(roster) {
  return Object.fromEntries(
    roster.map((student) => [student.id, { status: 'present', remarks: '' }])
  );
}

function entriesFromSession(roster, session) {
  if (!session) return emptyEntries(roster);
  return Object.fromEntries(
    roster.map((student) => {
      const entry = session.entries.find((item) => item.studentId === student.id);
      return [
        student.id,
        {
          status: entry?.status || 'present',
          remarks: entry?.remarks || '',
        },
      ];
    })
  );
}

export default function Attendance() {
  const { data, user, notify, refresh } = useAppData();
  const [searchParams] = useSearchParams();
  const classes = getInchargeClasses(data, user.id);
  const queryClass = searchParams.get('class');
  const queryDate = searchParams.get('date');
  const initialDate =
    queryDate &&
    /^\d{4}-\d{2}-\d{2}$/.test(queryDate) &&
    queryDate <= todayISO()
      ? queryDate
      : todayISO();
  const [section, setSection] = useState(
    classes.some((cls) => cls.id === queryClass) ? queryClass : classes[0]?.id || ''
  );
  const [date, setDate] = useState(initialDate);
  const [sessionType, setSessionType] = useState(() =>
    primarySessionType(attendanceModeOf(data.meta))
  );
  const [entries, setEntries] = useState({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [reasonTarget, setReasonTarget] = useState(null);
  const [reasonDraft, setReasonDraft] = useState({ status: 'absent', remarks: '' });
  const [saving, setSaving] = useState(false);

  const activeClass = classes.find((cls) => cls.id === section) || classes[0];
  const mode = attendanceModeOf(data.meta);
  const sessionTypes = useMemo(() => sessionTypesFor(mode), [mode]);
  const roster = useMemo(
    () =>
      data.students
        .filter((student) => student.classIdSection === activeClass?.id)
        .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber)),
    [data.students, activeClass?.id]
  );
  const savedSession = activeClass
    ? findSession(data, activeClass.id, date, sessionType)
    : null;

  useEffect(() => {
    if (!classes.length) return;
    if (!classes.some((cls) => cls.id === section)) {
      setSection(classes[0].id);
    }
  }, [classes, section]);

  // The admin can switch the school between two sessions and one full-day
  // register; keep the selected tab valid without a reload.
  useEffect(() => {
    if (!sessionTypes.includes(sessionType)) {
      if (dirtyRef.current) {
        notify('The school changed the attendance mode. Your unsaved changes were cleared.', 'info');
      }
      setSessionType(sessionTypes[0]);
    }
  }, [sessionTypes, sessionType, notify]);

  useEffect(() => {
    const next = entriesFromSession(roster, savedSession);
    baselineRef.current = JSON.stringify(
      roster.map((student) => ({
        studentId: student.id,
        status: next[student.id]?.status || 'present',
        remarks: next[student.id]?.remarks || '',
      }))
    );
    setEntries(next);
    setFilter('all');
    setSearch('');
  }, [section, date, sessionType, savedSession?.id, savedSession?.submittedAt, roster.length]);

  const computedEntries = roster.map((student) => ({
    studentId: student.id,
    ...entries[student.id],
  }));
  const stats = attendanceStats(computedEntries);
  const baselineRef = useRef('');
  const signature = (source = entries) =>
    JSON.stringify(
      roster.map((student) => ({
        studentId: student.id,
        status: source[student.id]?.status || 'present',
        remarks: source[student.id]?.remarks || '',
      }))
    );
  const dirty = signature() !== baselineRef.current;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useEffect(() => {
    const handler = (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const confirmDiscard = () => {
    if (!dirtyRef.current) return true;
    return window.confirm(
      'You have unsaved attendance changes. Leave this register and discard them?'
    );
  };

  const canSubmit = Boolean(savedSession) === false || dirty;

  const visibleStudents = roster.filter((student) => {
    const entry = entries[student.id];
    const matchesSearch =
      !search.trim() ||
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.rollNumber.includes(search.trim());
    const matchesFilter = filter === 'all' || entry?.status === filter;
    return matchesSearch && matchesFilter;
  });

  const updateStatus = (student, status) => {
    setEntries((current) => ({
      ...current,
      [student.id]: {
        status,
        remarks: status === 'present' ? '' : current[student.id]?.remarks || '',
      },
    }));
    if (status !== 'present') {
      const existing = entries[student.id];
      setReasonDraft({
        status,
        remarks: existing?.remarks || '',
        studentName: student.name,
      });
      setReasonTarget(student);
    }
  };

  const openReason = (student) => {
    const entry = entries[student.id] || { status: 'present', remarks: '' };
    setReasonDraft({
      status: entry.status === 'present' ? 'absent' : entry.status,
      remarks: entry.remarks,
      studentName: student.name,
    });
    setReasonTarget(student);
  };

  const applyReason = () => {
    if (!reasonTarget) return;
    setEntries((current) => ({
      ...current,
      [reasonTarget.id]: {
        status: reasonDraft.status,
        remarks: reasonDraft.remarks.trim(),
      },
    }));
    setReasonTarget(null);
  };

  const markAllPresent = () => {
    setEntries(emptyEntries(roster));
    notify('All students set to present. Remember to submit the register.', 'info');
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveAttendance(user.id, {
        classIdSection: activeClass.id,
        date,
        sessionType,
        entries: computedEntries,
      });
      await refresh({ silent: true });
      baselineRef.current = signature();
      notify(
        `Attendance saved for ${activeClass.displayName} · ${stats.present} present, ${stats.absent} absent.`,
        'success'
      );
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!classes.length) {
    return (
      <div className="t-page">
        <PageHead
          eyebrow="Roll-call"
          title="Attendance"
          subtitle="You are not currently the attendance incharge of a class."
        />
        <EmptyState
          icon={Users}
          title="No roll-call assigned"
          message="Ask the school office to make you the attendance incharge for your class."
        />
      </div>
    );
  }

  return (
    <div className="t-page attendance-page">
      <PageHead
        eyebrow="Zero-friction roll-call"
        title="Attendance"
        subtitle={formatDateLong(date, { year: 'numeric' })}
        action={
          <Badge tone={savedSession ? 'success' : 'warning'} icon={savedSession ? CheckCheck : Clock3}>
            {savedSession ? 'Submitted' : 'Not marked'}
          </Badge>
        }
      />

      <div className="class-pills" role="tablist" aria-label="Choose class">
        {classes.map((cls) => (
          <button
            key={cls.id}
            type="button"
            role="tab"
            aria-selected={cls.id === activeClass?.id}
            className={`class-pill ${cls.id === activeClass?.id ? 'active' : ''}`}
            onClick={() => {
              if (cls.id !== activeClass?.id && confirmDiscard()) setSection(cls.id);
            }}
          >
            {cls.displayName}
          </button>
        ))}
      </div>

      <Link to="/attendance/registry" className="wide-link-card attendance-registry-link">
        <span className="work-icon teal">
          <CalendarDays size={20} />
        </span>
        <span>
          <strong>Monthly attendance registry</strong>
          <small>See the full month as a GitHub-style calendar.</small>
        </span>
        <ArrowRight size={18} />
      </Link>

      <section className="card attendance-toolbar">
        <label className="field field-compact">
          <span>
            <CalendarDays size={14} /> Date
          </span>
          <input
            type="date"
            value={date}
            max={todayISO()}
            onChange={(event) => {
              const next = event.target.value;
              if (!next || next === date) return;
              if (confirmDiscard()) setDate(next);
            }}
          />
        </label>
        <div
          className={`segmented ${sessionTypes.length > 1 ? 'segmented-2' : ''}`}
          role="group"
          aria-label="Session"
        >
          {sessionTypes.map((type) => (
            <button
              key={type}
              type="button"
              className={sessionType === type ? 'active' : ''}
              aria-pressed={sessionType === type}
              onClick={() => {
                if (type !== sessionType && confirmDiscard()) setSessionType(type);
              }}
            >
              {sessionTypeLabel(type)}
            </button>
          ))}
        </div>
      </section>

      {mode === 'fullDay' ? (
        <p className="attendance-mode-note">
          This school records one register for the whole day. Morning and afternoon
          are not tracked separately.
        </p>
      ) : null}

      {savedSession ? (
        <div className="saved-banner">
          <span className="saved-icon">
            <Check size={15} />
          </span>
          <div>
            <strong>Register already submitted</strong>
            <span>
              {relativeTime(savedSession.submittedAt)} · edits will update the same register.
            </span>
          </div>
        </div>
      ) : null}

      <section className="card attendance-summary">
        <ProgressRing
          value={stats.rate}
          size={104}
          stroke={10}
          color={stats.rate >= 90 ? 'var(--success)' : stats.rate >= 75 ? 'var(--warning)' : 'var(--danger)'}
          track="var(--slate-100)"
        >
          <strong>{Math.round(stats.rate)}%</strong>
          <span>present</span>
        </ProgressRing>
        <div className="attendance-summary-grid">
          {STATUS_OPTIONS.map((status) => {
            const meta = attendanceMeta(status);
            return (
              <button
                key={status}
                type="button"
                className={`summary-count summary-${status}`}
                onClick={() => setFilter(filter === status ? 'all' : status)}
              >
                <span>{meta.label}</span>
                <strong>{stats[status]}</strong>
              </button>
            );
          })}
        </div>
        <div className="attendance-summary-foot">
          <span>
            <Users size={14} /> {roster.length} students · {classLabel(data, activeClass?.id)}
          </span>
          {dirty ? (
            <Badge tone="warning">Unsaved changes</Badge>
          ) : savedSession ? (
            <Badge tone="success">Saved</Badge>
          ) : (
            <Badge tone="brand">Not submitted yet</Badge>
          )}
        </div>
      </section>

      <div className="attendance-actions">
        <div className="search-input">
          <Search size={17} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or roll number"
            aria-label="Search students"
          />
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={markAllPresent}>
          <CheckCheck size={16} /> All present
        </button>
      </div>

      <div className="filter-pills" role="tablist" aria-label="Filter attendance">
        <button
          type="button"
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All <span>{roster.length}</span>
        </button>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type="button"
            className={filter === status ? 'active' : ''}
            onClick={() => setFilter(status)}
          >
            {attendanceMeta(status).label} <span>{stats[status]}</span>
          </button>
        ))}
      </div>

      <div className="student-list">
        {visibleStudents.map((student) => {
          const entry = entries[student.id] || { status: 'present', remarks: '' };
          const history = studentAttendance(data, student.id);
          return (
            <article
              key={student.id}
              className={`student-row ${entry.status !== 'present' ? `student-row-${entry.status}` : ''}`}
            >
              <div className="student-row-top">
                <Avatar name={student.name} size={38} photo={student.photo} />
                <div className="student-row-name">
                  <strong>{student.name}</strong>
                  <span>
                    Roll {student.rollNumber} · {history.rate}% overall
                  </span>
                </div>
                <Badge tone={attendanceMeta(entry.status).tone}>
                  {attendanceMeta(entry.status).label}
                </Badge>
              </div>

              <div className="attendance-switch" role="group" aria-label={`Attendance for ${student.name}`}>
                {STATUS_OPTIONS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className={`${status} ${entry.status === status ? 'active' : ''}`}
                    onClick={() => updateStatus(student, status)}
                    aria-pressed={entry.status === status}
                  >
                    <span className="switch-dot" />
                    {attendanceMeta(status).label}
                  </button>
                ))}
              </div>

              {entry.status !== 'present' ? (
                <div className="student-row-reason">
                  {entry.remarks ? (
                    <span className="reason-chip">
                      <MessageSquareText size={13} />
                      {entry.remarks}
                      <button type="button" onClick={() => openReason(student)} aria-label="Edit reason">
                        Edit
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="reason-link" onClick={() => openReason(student)}>
                      <MessageSquareText size={13} /> Add a reason
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
        {!visibleStudents.length ? (
          <EmptyState
            icon={Search}
            title="No students match"
            message="Try clearing the search or choosing another filter."
          />
        ) : null}
      </div>

      <div className="sticky-save">
        <div className="sticky-save-info">
          <span>
            {dirty ? 'Unsaved changes' : savedSession ? 'Register saved' : 'Ready to submit'}
          </span>
          <strong>
            {stats.present}/{stats.total} present
          </strong>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={save}
          disabled={saving || !canSubmit}
        >
          {saving ? <span className="btn-spinner" /> : <Send size={17} />}
          {saving ? 'Saving…' : canSubmit ? 'Submit attendance' : 'Submitted'}
        </button>
      </div>

      <Sheet
        open={Boolean(reasonTarget)}
        title="Reason for absence"
        subtitle={reasonDraft.studentName ? `For ${reasonDraft.studentName}` : ''}
        onClose={() => setReasonTarget(null)}
        footer={
          <div className="sheet-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setReasonTarget(null)}>
              Skip reason
            </button>
            <button type="button" className="btn btn-primary" onClick={applyReason}>
              Save reason
            </button>
          </div>
        }
      >
        <div className="reason-grid">
          {REASONS.map((reason) => (
            <button
              key={reason.label}
              type="button"
              className={`reason-option ${
                reasonDraft.remarks === reason.label ? 'selected' : ''
              }`}
              onClick={() =>
                setReasonDraft((current) => ({
                  ...current,
                  remarks: reason.label,
                  status: reason.status,
                }))
              }
            >
              <span aria-hidden="true">{reason.icon}</span>
              <span>{reason.label}</span>
              <Badge tone={attendanceMeta(reason.status).tone}>
                {attendanceMeta(reason.status).label}
              </Badge>
            </button>
          ))}
        </div>
        <label className="field">
          <span>Custom note (optional)</span>
          <textarea
            rows={3}
            value={reasonDraft.remarks}
            onChange={(event) =>
              setReasonDraft((current) => ({ ...current, remarks: event.target.value }))
            }
            placeholder="Add a short note for the class teacher or principal"
          />
        </label>
        <div className="status-note">
          <AlertCircle size={15} />
          The reason is visible to the admin attendance desk. Absence reasons are not private.
        </div>
      </Sheet>
    </div>
  );
}
