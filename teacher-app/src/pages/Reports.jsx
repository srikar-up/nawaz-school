import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  MessageCircle,
  Phone,
  Printer,
  Search,
  Send,
  TriangleAlert,
  UserRound,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import ProgressRing from '../components/ProgressRing';
import Sheet from '../components/Sheet';
import {
  classLabel,
  compareRoll,
  formatDate,
  getTeacherClasses,
  isStudentAtRisk,
  studentAttendance,
  studentAverage,
  studentScores,
} from '../lib/format';

function whatsappNumber(phone) {
  return String(phone || '').replace(/\D/g, '');
}

export default function Reports() {
  const { data, user } = useAppData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [sendOpen, setSendOpen] = useState(false);
  const classes = getTeacherClasses(data, user.id);
  const classIds = new Set(classes.map((cls) => cls.id));
  const roster = data.students
    .filter((student) => classIds.has(student.classIdSection))
    .sort((a, b) =>
      String(a.classIdSection).localeCompare(String(b.classIdSection)) ||
      compareRoll(a.rollNumber, b.rollNumber)
    );
  const selectedId = searchParams.get('student');
  const selected = selectedId ? data.students.find((student) => student.id === selectedId) : null;

  if (selected && classIds.has(selected.classIdSection)) {
    const attendance = studentAttendance(data, selected.id);
    const scores = studentScores(data, selected.id);
    const average = studentAverage(data, selected.id);
    const atRisk = isStudentAtRisk(data, selected.id);
    const selectedClass = data.classes.find((cls) => cls.id === selected.classIdSection);
    const classmates = roster.filter(
      (student) => student.classIdSection === selected.classIdSection
    );
    const ranked = classmates
      .map((student) => ({ id: student.id, average: studentAverage(data, student.id) }))
      .filter((entry) => entry.average !== null)
      .sort((a, b) => b.average - a.average);
    const rank = ranked.findIndex((entry) => entry.id === selected.id) + 1;
    const remark = atRisk
      ? `${selected.name.split(' ')[0]} is currently below the school risk threshold. Please arrange a short check-in with the student and guardian, and review the recent assessments together.`
      : `${selected.name.split(' ')[0]} is making steady progress. Attendance and assessment results are within the expected range. Encourage continued consistency in classwork and revision.`;
    const message = [
      `Nawaz School System — Progress Update`,
      `Student: ${selected.name} (Roll ${selected.rollNumber})`,
      `Class: ${selectedClass?.displayName || selected.classIdSection}`,
      `Attendance: ${attendance.rate}% (${attendance.present}/${attendance.total} sessions)`,
      `Assessment average: ${average !== null ? `${average}%` : 'Not available'}`,
      `Status: ${atRisk ? 'Needs support' : 'On track'}`,
      '',
      `Teacher remark: ${remark}`,
      '',
      'Please contact the school office if you would like to discuss this report.',
    ].join('\n');

    return (
      <div className="t-page report-page">
        <PageHead
          backTo="/reports"
          eyebrow="Progress report"
          title={selected.name}
          subtitle={`${selectedClass?.displayName} · Roll ${selected.rollNumber}`}
          action={
            <button type="button" className="icon-btn" onClick={() => window.print()} aria-label="Print report">
              <Printer size={19} />
            </button>
          }
        />

        <div className="report-print-area">
          <section className="report-card">
            <div className="report-school">
              <span className="report-logo">
                <BookOpen size={22} />
              </span>
              <div>
                <strong>NAWAZ SCHOOL SYSTEM</strong>
                <span>Student progress & attendance slip</span>
              </div>
              <Badge tone={atRisk ? 'danger' : 'success'}>
                {atRisk ? 'Needs support' : 'On track'}
              </Badge>
            </div>

            <div className="report-student">
              <Avatar name={selected.name} size={58} photo={selected.photo} />
              <div>
                <h2>{selected.name}</h2>
                <p>
                  {selectedClass?.displayName} · Roll {selected.rollNumber} · {selected.code}
                </p>
                <span>{selected.guardianName} · {selected.parentPhone}</span>
              </div>
              <div className="report-rank">
                <Award size={18} />
                <strong>{rank ? `#${rank}` : '—'}</strong>
                <span>class rank</span>
              </div>
            </div>

            <div className="report-stats">
              <div className="report-stat">
                <ProgressRing
                  value={attendance.rate}
                  size={78}
                  stroke={7}
                  color={attendance.rate >= 75 ? 'var(--success)' : 'var(--warning)'}
                  track="var(--slate-100)"
                >
                  <strong>{Math.round(attendance.rate)}%</strong>
                </ProgressRing>
                <span>Attendance</span>
              </div>
              <div className="report-stat-number">
                <strong>{average !== null ? `${Math.round(average)}%` : '—'}</strong>
                <span>Assessment average</span>
              </div>
              <div className="report-stat-number">
                <strong>{scores.length}</strong>
                <span>Assessments</span>
              </div>
              <div className="report-stat-number">
                <strong>{attendance.absent}</strong>
                <span>Absences</span>
              </div>
            </div>

            <div className="report-section">
              <div className="section-head">
                <h3>Recent assessments</h3>
                <span className="muted small">Last {Math.min(scores.length, 5)}</span>
              </div>
              {scores.length ? (
                <div className="report-score-table">
                  <div className="report-score-head">
                    <span>Assessment</span>
                    <span>Score</span>
                    <span>Result</span>
                  </div>
                  {scores.slice(0, 5).map((score) => (
                    <div key={score.id} className="report-score-row">
                      <span>
                        <strong>{score.examTitle || score.subject}</strong>
                        <small>
                          {score.subject} · {formatDate(score.enteredAt.slice(0, 10))}
                        </small>
                      </span>
                      <strong>
                        {score.marksObtained}/{score.maxMarks}
                      </strong>
                      <Badge tone={score.percentage < 35 ? 'danger' : 'success'}>
                        {Math.round(score.percentage)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">No scores recorded yet.</p>
              )}
            </div>

            <div className="report-section">
              <h3>Attendance summary</h3>
              <div className="attendance-bars">
                {[
                  ['Present', attendance.present, 'success'],
                  ['Absent', attendance.absent, 'danger'],
                  ['Late', attendance.late, 'warning'],
                  ['Excused', attendance.excused, 'info'],
                ].map(([label, value, tone]) => {
                  const width = attendance.total ? Math.round((value / attendance.total) * 100) : 0;
                  return (
                    <div key={label} className="attendance-bar-row">
                      <span>{label}</span>
                      <div className="attendance-bar-track">
                        <i className={`attendance-bar-fill ${tone}`} style={{ width: `${width}%` }} />
                      </div>
                      <strong>{value}</strong>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="report-section teacher-remark">
              <h3>Teacher remark</h3>
              <p>{remark}</p>
              <span className="remark-sign">— {user.name}</span>
            </div>

            <div className="report-foot">
              <span>Generated {formatDate(new Date())} · Nawaz School System</span>
              <span>{selectedClass?.classTeacherName} · Class teacher</span>
            </div>
          </section>
        </div>

        <div className="report-actions">
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={17} /> Print / save PDF
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setSendOpen(true)}>
            <MessageCircle size={17} /> Send to parent
          </button>
        </div>

        <p className="data-footnote">
          <Phone size={13} /> Opens WhatsApp with a prefilled progress message. No message is sent
          automatically.
        </p>

        <Sheet
          open={sendOpen}
          title="Send progress to parent"
          subtitle={`${selected.guardianName} · ${selected.parentPhone}`}
          onClose={() => setSendOpen(false)}
          footer={
            <div className="sheet-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setSendOpen(false)}>
                Cancel
              </button>
              <a
                className="btn btn-primary"
                href={`https://wa.me/${whatsappNumber(selected.parentPhone)}?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setSendOpen(false)}
              >
                <Send size={16} /> Open WhatsApp
              </a>
            </div>
          }
        >
          <div className="whatsapp-preview">
            <div className="whatsapp-head">
              <span className="avatar" style={{ background: '#128C7E', width: 38, height: 38 }}>
                {selected.guardianName?.slice(0, 1) || 'P'}
              </span>
              <span>
                <strong>{selected.guardianName}</strong>
                <small>{selected.parentPhone}</small>
              </span>
            </div>
            <pre>{message}</pre>
          </div>
          <div className="status-note">
            <CheckCircle2 size={15} />
            Review the message preview before opening WhatsApp. The school is not notified when the
            message is sent.
          </div>
        </Sheet>
      </div>
    );
  }

  const visible = roster.filter((student) => {
    const matchesClass = classFilter === 'all' || student.classIdSection === classFilter;
    const matchesSearch =
      !search.trim() ||
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.rollNumber.includes(search.trim());
    return matchesClass && matchesSearch;
  });

  return (
    <div className="t-page">
      <PageHead
        backTo="/more"
        eyebrow="Student progress"
        title="Reports"
        subtitle="Attendance, assessment results and a parent-ready progress slip."
      />

      <div className="search-input">
        <Search size={17} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Find a student"
          aria-label="Find a student"
        />
      </div>

      <div className="filter-pills">
        <button
          type="button"
          className={classFilter === 'all' ? 'active' : ''}
          onClick={() => setClassFilter('all')}
        >
          All classes <span>{roster.length}</span>
        </button>
        {classes.map((cls) => (
          <button
            key={cls.id}
            type="button"
            className={classFilter === cls.id ? 'active' : ''}
            onClick={() => setClassFilter(cls.id)}
          >
            {cls.displayName}
          </button>
        ))}
      </div>

      <div className="student-directory">
        {visible.map((student) => {
          const attendance = studentAttendance(data, student.id);
          const average = studentAverage(data, student.id);
          const atRisk = isStudentAtRisk(data, student.id);
          return (
            <button
              key={student.id}
              type="button"
              className="directory-row"
              onClick={() => setSearchParams({ student: student.id })}
            >
              <Avatar name={student.name} size={40} photo={student.photo} />
              <span className="directory-name">
                <strong>{student.name}</strong>
                <small>
                  {classLabel(data, student.classIdSection)} · Roll {student.rollNumber} ·{' '}
                  {attendance.rate}% attendance
                </small>
              </span>
              {atRisk ? (
                <Badge tone="danger" icon={TriangleAlert}>
                  Risk
                </Badge>
              ) : average !== null ? (
                <span className="student-average">{Math.round(average)}%</span>
              ) : (
                <ChevronRight size={17} className="directory-chevron" />
              )}
            </button>
          );
        })}
        {!visible.length ? (
          <EmptyState
            icon={Users}
            title="No students found"
            message="Try another class filter or search term."
          />
        ) : null}
      </div>

      <div className="info-strip neutral">
        <UserRound size={17} />
        <span>
          Reports combine live attendance and every assessment recorded by the school. Use the print
          action to save a PDF.
        </span>
      </div>
    </div>
  );
}
