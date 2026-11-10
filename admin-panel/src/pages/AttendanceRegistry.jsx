import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Search, Users } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import StudentAttendanceRegistry from '../components/StudentAttendanceRegistry';

export default function AttendanceRegistry() {
  const { data } = useAppData();
  const [classFilter, setClassFilter] = useState('all');
  const [search, setSearch] = useState('');

  const sessions = useMemo(
    () =>
      classFilter === 'all'
        ? data.attendanceSessions
        : data.attendanceSessions.filter(
            (session) => session.classIdSection === classFilter
          ),
    [classFilter, data.attendanceSessions]
  );
  const students = useMemo(() => {
    const text = search.trim().toLowerCase();
    return data.students.filter((student) => {
      const matchesClass =
        classFilter === 'all' || student.classIdSection === classFilter;
      const matchesSearch =
        !text ||
        student.name.toLowerCase().includes(text) ||
        String(student.rollNumber).includes(text) ||
        student.classIdSection.toLowerCase().includes(text);
      return matchesClass && matchesSearch;
    });
  }, [classFilter, data.students, search]);
  const selectedClass =
    classFilter === 'all'
      ? null
      : data.classes.find((cls) => cls.id === classFilter);

  return (
    <div className="admin-page">
      <PageHeader
        eyebrow="Attendance registry"
        title="Monthly attendance"
        subtitle="One row per student, every day of the month, and a rate column — a full school register at a glance."
        actions={
          <Link to="/attendance" className="admin-btn admin-btn-secondary">
            <ArrowLeft size={16} /> Daily view
          </Link>
        }
      />

      <section className="admin-card attendance-registry-toolbar">
        <div className="attendance-registry-class">
          <span className="class-id-badge">
            <CalendarDays size={16} />
          </span>
          <div>
            <span className="admin-eyebrow">Filter registry</span>
            <strong>{selectedClass ? selectedClass.displayName : 'Whole school'}</strong>
          </div>
          <select
            value={classFilter}
            onChange={(event) => setClassFilter(event.target.value)}
            aria-label="Filter monthly attendance by class"
          >
            <option value="all">Whole school</option>
            {data.classes.map((cls) => (
              <option key={cls.id} value={cls.id}>
                {cls.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-search attendance-registry-search">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a student, roll or class"
            aria-label="Search the monthly attendance registry"
          />
        </div>
        <div className="attendance-registry-meta">
          <span>
            <Users size={14} /> {students.length} students
          </span>
          <Badge tone="brand">One square = one school day</Badge>
        </div>
      </section>

      <StudentAttendanceRegistry
        students={students}
        sessions={sessions}
        showClass={classFilter === 'all'}
        title={selectedClass ? `${selectedClass.displayName} attendance` : 'Whole-school attendance'}
        subtitle={
          selectedClass
            ? `Every student in ${selectedClass.displayName}, with a colour-coded day for each register.`
            : 'All students across the school. Use the class filter or search to narrow the register.'
        }
      />
    </div>
  );
}
