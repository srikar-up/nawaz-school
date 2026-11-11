import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  GraduationCap,
  Layers,
  MapPin,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { api } from '../lib/api';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import {
  attendanceStats,
  findSession,
  formatDate,
  formatTime,
  todayISO,
} from '../lib/format';
import { getTimetableConfig, weekDatesForDays } from '../lib/timetable';

const SUBJECT_TONES = [
  { bg: '#EEF2FF', border: '#C7D2FE', text: '#3730A3' },
  { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
  { bg: '#FFFBEB', border: '#FDE68A', text: '#92400E' },
  { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
  { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
  { bg: '#F5F3FF', border: '#DDD6FE', text: '#5B21B6' },
];

export default function Classes() {
  const { data, user, notify, refresh } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [classId, setClassId] = useState(data.classes[0]?.id || '');
  const [savingSubjectId, setSavingSubjectId] = useState(null);
  const tab = searchParams.get('tab') === 'timetable' ? 'timetable' : 'overview';
  const selectedClass = data.classes.find((cls) => cls.id === classId) || data.classes[0];
  const teachers = data.staff.filter(
    (member) => member.isActive && ['Teacher', 'Principal', 'Vice Principal'].includes(member.staffType)
  );
  const classTeacher = data.staff.find(
    (member) => member.id === selectedClass?.classTeacherId
  );
  const subjects = data.subjects.filter(
    (subject) => subject.classIdSection === selectedClass?.id
  );
  const roster = data.students.filter(
    (student) => student.classIdSection === selectedClass?.id
  );
  const session = selectedClass ? findSession(data, selectedClass.id, todayISO()) : null;
  const stats = session ? attendanceStats(session.entries) : null;
  const subjectToneMap = useMemo(
    () =>
      Object.fromEntries(
        subjects.map((subject, index) => [subject.id, SUBJECT_TONES[index % SUBJECT_TONES.length]])
      ),
    [subjects]
  );
  const timetableConfig = useMemo(() => getTimetableConfig(data), [data]);
  const dates = useMemo(
    () => weekDatesForDays(timetableConfig.days),
    [timetableConfig.days]
  );
  const activeDay = timetableConfig.days.includes(new Date().getDay())
    ? new Date().getDay()
    : timetableConfig.days[0];

  const assignTeacher = async (subject, assignedStaffId) => {
    setSavingSubjectId(subject.id);
    try {
      await api.assignSubjectTeacher(user.id, subject.id, assignedStaffId);
      await refresh({ silent: true });
      notify(`${subject.subjectName} teacher updated for ${subject.classIdSection}.`, 'success');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSavingSubjectId(null);
    }
  };

  const subjectProgress = (subject) => {
    const total = subject.chapters.length || 1;
    const done = subject.chapters.filter((chapter) => chapter.status === 'completed').length;
    return Math.round((done / total) * 100);
  };

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Academic structure"
        title="Classes & subjects"
        subtitle="Assign subject teachers, review syllabus progress and see the weekly timetable."
        actions={
          <div className="admin-view-tabs">
            <button
              type="button"
              className={tab === 'overview' ? 'active' : ''}
              onClick={() => setSearchParams({}, { replace: true })}
            >
              <Layers size={15} /> Subjects
            </button>
            <button
              type="button"
              className={tab === 'timetable' ? 'active' : ''}
              onClick={() => setSearchParams({ tab: 'timetable' }, { replace: true })}
            >
              <CalendarDays size={15} /> Timetable
            </button>
          </div>
        }
      />

      <div className="class-selector-strip">
        {data.classes.map((cls) => {
          const rosterCount = data.students.filter(
            (student) => student.classIdSection === cls.id
          ).length;
          return (
            <button
              key={cls.id}
              type="button"
              className={`class-selector-card ${cls.id === selectedClass?.id ? 'active' : ''}`}
              onClick={() => setClassId(cls.id)}
            >
              <span className="class-id-badge">{cls.id}</span>
              <span>
                <strong>{cls.displayName}</strong>
                <small>
                  {rosterCount} students · {cls.room}
                </small>
              </span>
              {cls.id === selectedClass?.id ? <Check size={16} /> : <ChevronRight size={16} />}
            </button>
          );
        })}
      </div>

      <section className="class-summary-panel">
        <div className="class-summary-main">
          <span className="class-summary-icon">
            <GraduationCap size={25} />
          </span>
          <div>
            <h2>{selectedClass?.displayName}</h2>
            <p>
              Class teacher {classTeacher?.name || 'Unassigned'} · {selectedClass?.room} ·{' '}
              {selectedClass?.academicYear}
            </p>
          </div>
        </div>
        <div className="class-summary-stats">
          <div>
            <strong>{roster.length}</strong>
            <span>Students</span>
          </div>
          <div>
            <strong>{subjects.length}</strong>
            <span>Subjects</span>
          </div>
          <div>
            <strong>{stats ? `${stats.rate}%` : '—'}</strong>
            <span>Attendance today</span>
          </div>
          <div>
            <strong>
              {stats ? `${stats.present}/${stats.total}` : '—'}
            </strong>
            <span>Present</span>
          </div>
        </div>
      </section>

      {tab === 'overview' ? (
        <div className="classes-layout">
          <section className="admin-card subject-list-card">
            <div className="admin-card-head">
              <div>
                <h2>Subject offerings</h2>
                <p>Assign a teacher to each subject in {selectedClass?.displayName}.</p>
              </div>
              <div className="subject-head-actions">
                <Badge tone="brand">{subjects.length} subjects</Badge>
                <Link to="/curriculum" className="admin-btn admin-btn-secondary admin-btn-sm">
                  <BookOpen size={14} /> Manage curriculum
                </Link>
              </div>
            </div>
            <div className="subject-offering-list">
              {subjects.map((subject) => {
                const progress = subjectProgress(subject);
                const teacher = data.staff.find(
                  (member) => member.id === subject.assignedStaffId
                );
                return (
                  <div key={subject.id} className="subject-offering-row">
                    <span className="subject-offering-icon">
                      <BookOpen size={18} />
                    </span>
                    <div className="subject-offering-main">
                      <div className="subject-offering-title">
                        <strong>{subject.subjectName}</strong>
                        <span>{subject.subjectCode}</span>
                        {subject.isLab ? <Badge tone="info">Lab</Badge> : null}
                      </div>
                      <div className="subject-offering-progress">
                        <div className="admin-progress-track">
                          <i style={{ width: `${progress}%` }} />
                        </div>
                        <span>{progress}% syllabus</span>
                        <small>
                          {subject.chapters.filter((chapter) => chapter.status === 'completed').length}/
                          {subject.chapters.length} chapters done
                        </small>
                      </div>
                    </div>
                    <div className="subject-teacher-select">
                      <Avatar name={teacher?.name} size={30} photo={teacher?.photo} />
                      <select
                        value={subject.assignedStaffId}
                        onChange={(event) => assignTeacher(subject, event.target.value)}
                        disabled={savingSubjectId === subject.id}
                        aria-label={`Teacher for ${subject.subjectName}`}
                      >
                        {!teachers.some((member) => member.id === subject.assignedStaffId) ? (
                          <option value={subject.assignedStaffId}>
                            {subject.assignedTeacherName}
                          </option>
                        ) : null}
                        {teachers.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                      {savingSubjectId === subject.id ? (
                        <RefreshCw size={14} className="spin" />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <aside className="classes-aside">
            <section className="admin-card class-teacher-card">
              <div className="admin-card-head">
                <div>
                  <h2>Class teacher</h2>
                  <p>Owns the section roster</p>
                </div>
              </div>
              <div className="class-teacher-profile">
                <Avatar name={classTeacher?.name} size={54} photo={classTeacher?.photo} />
                <div>
                  <strong>{classTeacher?.name || 'Unassigned'}</strong>
                  <span>{classTeacher?.department || 'No department'}</span>
                  <small>{classTeacher?.email || 'Assign a class teacher in staff records.'}</small>
                </div>
              </div>
              <div className="class-teacher-meta">
                <span>
                  <Users size={14} /> {roster.length} students
                </span>
                <span>
                  <MapPin size={14} /> {selectedClass?.room}
                </span>
                <span>
                  <Clock3 size={14} /> {selectedClass?.academicYear}
                </span>
              </div>
            </section>

            <section className="admin-card class-attendance-card">
              <div className="admin-card-head">
                <div>
                  <h2>Today’s register</h2>
                  <p>Today's attendance</p>
                </div>
                <Badge tone={session ? 'success' : 'warning'} dot>
                  {session ? 'Submitted' : 'Waiting'}
                </Badge>
              </div>
              {stats ? (
                <>
                  <div className="class-attendance-rate">
                    <strong>{stats.rate}%</strong>
                    <span>{stats.present} present · {stats.absent} absent</span>
                  </div>
                  <div className="class-attendance-split">
                    {['present', 'absent', 'late', 'excused'].map((status) => (
                      <div key={status}>
                        <span>{status}</span>
                        <strong>{stats[status]}</strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="muted small">
                  No morning register has been submitted for this class today.
                </p>
              )}
            </section>
          </aside>
        </div>
      ) : (
        <section className="admin-card timetable-card">
          <div className="admin-card-head">
            <div>
              <h2>{selectedClass?.displayName} weekly timetable</h2>
              <p>
                {timetableConfig.periods.length} periods a day,{' '}
                {timetableConfig.dayOptions.map((day) => day.short).join(' · ')}. Hover a cell for
                teacher details.
              </p>
            </div>
            <div className="timetable-head-meta">
              <Badge tone="brand">Week of {formatDate(dates[0]?.date)}</Badge>
              <Link
                to={`/timetable?class=${selectedClass?.id}`}
                className="admin-btn admin-btn-secondary admin-btn-sm"
              >
                <CalendarDays size={14} /> Edit timetable
              </Link>
            </div>
          </div>
          <div className="timetable-grid-wrap">
            <table className="timetable-grid">
              <thead>
                <tr>
                  <th className="timetable-corner">Period</th>
                  {timetableConfig.dayOptions.map((day) => {
                    const date = dates.find((item) => item.value === day.value);
                    return (
                      <th key={day.value} className={activeDay === day.value ? 'today' : ''}>
                        <span>{day.label}</span>
                        <small>{date?.date.getDate()}</small>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timetableConfig.periods.map((period) => (
                  <tr key={period.periodNumber}>
                    <th className="timetable-period-cell">
                      <strong>P{period.periodNumber}</strong>
                      <span>{formatTime(period.startTime)}</span>
                      <small>{formatTime(period.endTime)}</small>
                    </th>
                    {timetableConfig.days.map((day) => {
                      const cell = data.timetable.find(
                        (entry) =>
                          entry.classIdSection === selectedClass?.id &&
                          entry.dayOfWeek === day &&
                          entry.periodNumber === period.periodNumber
                      );
                      const tone = cell ? subjectToneMap[cell.subjectId] : null;
                      return (
                        <td key={`${day}-${period.periodNumber}`} className={activeDay === day ? 'today' : ''}>
                          {cell ? (
                            <div
                              className="timetable-cell"
                              style={{
                                background: tone?.bg,
                                borderColor: tone?.border,
                                color: tone?.text,
                              }}
                              title={`${cell.subject} · ${cell.teacherName}`}
                            >
                              <strong>{cell.subject}</strong>
                              <span>{cell.teacherName}</span>
                              <small>{cell.room}</small>
                            </div>
                          ) : (
                            <span className="timetable-free">Free</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="timetable-legend">
            {subjects.map((subject) => (
              <span key={subject.id}>
                <i
                  style={{
                    background: subjectToneMap[subject.id]?.bg,
                    borderColor: subjectToneMap[subject.id]?.border,
                  }}
                />
                {subject.subjectName}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
