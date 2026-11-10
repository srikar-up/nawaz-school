import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Badge from '../components/Badge';
import PageHead from '../components/PageHead';
import {
  attendanceStats,
  findSession,
  getTeacherClasses,
  todayISO,
} from '../lib/format';

export default function Classes() {
  const { data, user } = useAppData();
  const classes = getTeacherClasses(data, user.id);
  const today = todayISO();

  return (
    <div className="t-page">
      <PageHead
        eyebrow="Your classroom"
        title="Classes"
        subtitle="Sections, subjects and student rosters assigned to you."
      />

      <div className="class-card-list">
        {classes.map((cls) => {
          const roster = data.students.filter(
            (student) => student.classIdSection === cls.id
          );
          const session = findSession(data, cls.id, today, 'Morning');
          const stats = session ? attendanceStats(session.entries) : null;
          return (
            <Link key={cls.id} to={`/classes/${cls.id}`} className="class-card">
              <div className="class-card-head">
                <span className="class-avatar">
                  <GraduationCap size={22} />
                </span>
                <div>
                  <h2>{cls.displayName}</h2>
                  <p>
                    <MapPin size={13} /> {cls.room} · {roster.length} students
                  </p>
                </div>
                <ChevronRight size={19} className="class-chevron" />
              </div>
              <div className="class-card-stats">
                <div>
                  <span>Attendance today</span>
                  <strong>{stats ? `${stats.rate}%` : '—'}</strong>
                  <small>{stats ? `${stats.present}/${stats.total} present` : 'Not marked'}</small>
                </div>
                <div>
                  <span>Class teacher</span>
                  <strong className="class-teacher-name">{cls.classTeacherName}</strong>
                  <small>{cls.academicYear}</small>
                </div>
              </div>
              <div className="class-card-foot">
                <div className="class-subjects">
                  {cls.mySubjects.slice(0, 3).map((subject) => (
                    <span key={subject.id} className="subject-chip">
                      <BookOpen size={12} /> {subject.subjectName}
                    </span>
                  ))}
                  {cls.mySubjects.length > 3 ? (
                    <span className="subject-chip">+{cls.mySubjects.length - 3}</span>
                  ) : null}
                </div>
                {cls.isIncharge ? (
                  <Badge tone="brand" icon={ShieldCheck}>
                    Incharge
                  </Badge>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      {!classes.length ? (
        <div className="soft-empty">No classes are assigned to you yet.</div>
      ) : null}

      <Link to="/timetable" className="wide-link-card">
        <span className="work-icon teal">
          <Users size={20} />
        </span>
        <span>
          <strong>Looking for the weekly timetable?</strong>
          <small>See every class and period in one place.</small>
        </span>
        <ArrowRight size={18} />
      </Link>
    </div>
  );
}
