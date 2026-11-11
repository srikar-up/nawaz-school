import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  GraduationCap,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
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
  attendanceStats,
  compareRoll,
  findSession,
  formatDate,
  getTeacherClasses,
  isStudentAtRisk,
  studentAttendance,
  studentAverage,
  studentScores,
  todayISO,
} from '../lib/format';

export default function ClassDetail() {
  const { classId } = useParams();
  const { data, user } = useAppData();
  const classes = getTeacherClasses(data, user.id);
  const cls = classes.find((entry) => entry.id === classId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  if (!cls) {
    return (
      <div className="t-page">
        <PageHead backTo="/classes" title="Class not available" />
        <EmptyState
          icon={GraduationCap}
          title="This class is not assigned to you"
          message="Only classes on your timetable or subject list can be opened here."
        />
      </div>
    );
  }

  const roster = data.students
    .filter((student) => student.classIdSection === cls.id)
    .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber));
  const session = findSession(data, cls.id, todayISO(), 'Morning');
  const stats = session ? attendanceStats(session.entries) : null;
  const visible = roster.filter(
    (student) =>
      !search.trim() ||
      student.name.toLowerCase().includes(search.toLowerCase()) ||
      student.rollNumber.includes(search.trim())
  );
  const selectedStudent = selected
    ? data.students.find((student) => student.id === selected)
    : null;
  const selectedAttendance = selectedStudent
    ? studentAttendance(data, selectedStudent.id)
    : null;
  const selectedScores = selectedStudent ? studentScores(data, selectedStudent.id) : [];
  const selectedAverage = selectedStudent ? studentAverage(data, selectedStudent.id) : null;

  return (
    <div className="t-page">
      <PageHead
        backTo="/classes"
        eyebrow="Class roster"
        title={cls.displayName}
        subtitle={`${cls.room} · ${cls.academicYear}`}
        action={
          cls.isIncharge ? (
            <Badge tone="brand" icon={ShieldCheck}>
              Incharge
            </Badge>
          ) : null
        }
      />

      <section className="class-detail-hero">
        <div className="class-detail-hero-top">
          <span className="class-detail-icon">
            <GraduationCap size={28} />
          </span>
          <div>
            <h2>{cls.displayName}</h2>
            <p>
              <MapPin size={13} /> {cls.room}
            </p>
          </div>
        </div>
        <div className="class-detail-stats">
          <div>
            <strong>{roster.length}</strong>
            <span>Students</span>
          </div>
          <div>
            <strong>{stats ? `${stats.rate}%` : '—'}</strong>
            <span>Today</span>
          </div>
          <div>
            <strong>{cls.mySubjects.length}</strong>
            <span>My subjects</span>
          </div>
        </div>
        <div className="class-detail-subjects">
          {cls.mySubjects.map((subject) => (
            <span key={subject.id}>
              <BookOpen size={12} /> {subject.subjectName}
            </span>
          ))}
        </div>
      </section>

      <div className="search-input">
        <Search size={17} />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search roster"
          aria-label="Search students"
        />
      </div>

      <div className="student-directory">
        {visible.map((student) => {
          const history = studentAttendance(data, student.id);
          const average = studentAverage(data, student.id);
          const atRisk = isStudentAtRisk(data, student.id);
          return (
            <button
              type="button"
              className="directory-row"
              key={student.id}
              onClick={() => setSelected(student.id)}
            >
              <Avatar name={student.name} size={40} photo={student.photo} />
              <span className="directory-name">
                <strong>{student.name}</strong>
                <small>
                  Roll {student.rollNumber} · {history.rate}% attendance
                  {average !== null ? ` · ${Math.round(average)}% average` : ''}
                </small>
              </span>
              {atRisk ? (
                <Badge tone="danger" icon={TriangleAlert}>
                  Risk
                </Badge>
              ) : (
                <ChevronRight size={17} className="directory-chevron" />
              )}
            </button>
          );
        })}
        {!visible.length ? (
          <EmptyState icon={Users} title="No students found" message="Try a different search." />
        ) : null}
      </div>

      <Sheet
        open={Boolean(selectedStudent)}
        title={selectedStudent?.name}
        subtitle={`${cls.displayName} · Roll ${selectedStudent?.rollNumber}`}
        onClose={() => setSelected(null)}
        footer={
          selectedStudent ? (
            <div className="sheet-actions">
              <a className="btn btn-secondary" href={`tel:${selectedStudent.parentPhone}`}>
                <Phone size={16} /> Call guardian
              </a>
              <Link
                to={`/reports?student=${selectedStudent.id}`}
                className="btn btn-primary"
                onClick={() => setSelected(null)}
              >
                <UserRound size={16} /> Progress report
              </Link>
            </div>
          ) : null
        }
      >
        {selectedStudent ? (
          <div className="student-sheet">
            <div className="student-sheet-top">
              <ProgressRing
                value={selectedAttendance.rate}
                size={104}
                stroke={10}
                color={
                  selectedAttendance.rate >= 75 ? 'var(--success)' : 'var(--warning)'
                }
                track="var(--slate-100)"
              >
                <strong>{selectedAttendance.rate}%</strong>
                <span>attendance</span>
              </ProgressRing>
              <div className="student-sheet-stats">
                <div>
                  <span>Present</span>
                  <strong>{selectedAttendance.present}</strong>
                </div>
                <div>
                  <span>Absent</span>
                  <strong>{selectedAttendance.absent}</strong>
                </div>
                <div>
                  <span>Late</span>
                  <strong>{selectedAttendance.late}</strong>
                </div>
                <div>
                  <span>Average</span>
                  <strong>{selectedAverage !== null ? `${Math.round(selectedAverage)}%` : '—'}</strong>
                </div>
              </div>
            </div>

            <div className="detail-list">
              <div>
                <span>Guardian</span>
                <strong>{selectedStudent.guardianName || 'Not recorded'}</strong>
              </div>
              <div>
                <span>Guardian phone</span>
                <strong>{selectedStudent.parentPhone || 'Not recorded'}</strong>
              </div>
              <div>
                <span>Date of birth</span>
                <strong>{formatDate(selectedStudent.dateOfBirth)}</strong>
              </div>
              <div>
                <span>Address</span>
                <strong>{selectedStudent.address || 'Not recorded'}</strong>
              </div>
            </div>

            <div className="sheet-section">
              <div className="section-head">
                <h3>Recent assessments</h3>
                {isStudentAtRisk(data, selectedStudent.id) ? (
                  <Badge tone="danger">Needs support</Badge>
                ) : (
                  <Badge tone="success">On track</Badge>
                )}
              </div>
              {selectedScores.length ? (
                <div className="score-list">
                  {selectedScores.slice(0, 5).map((score) => (
                    <div key={score.id} className="score-row">
                      <span>
                        <strong>{score.examTitle || score.subject}</strong>
                        <small>
                          {score.subject} · {formatDate(score.enteredAt.slice(0, 10))}
                        </small>
                      </span>
                      <span className={`score-value ${score.percentage < 35 ? 'low' : ''}`}>
                        {score.marksObtained}/{score.maxMarks}
                        <small>{Math.round(score.percentage)}%</small>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">No assessment scores recorded yet.</p>
              )}
            </div>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
