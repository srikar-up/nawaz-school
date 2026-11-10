import { useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import StudentAttendanceRegistry from '../components/StudentAttendanceRegistry';
import { getInchargeClasses } from '../lib/format';

export default function AttendanceRegistry() {
  const { data, user } = useAppData();
  const classes = getInchargeClasses(data, user.id);
  const [section, setSection] = useState(classes[0]?.id || '');
  const activeClass = classes.find((cls) => cls.id === section) || classes[0];

  const sessions = useMemo(
    () =>
      data.attendanceSessions.filter(
        (session) => session.classIdSection === activeClass?.id
      ),
    [activeClass?.id, data.attendanceSessions]
  );
  const students = useMemo(
    () =>
      data.students.filter(
        (student) => student.classIdSection === activeClass?.id
      ),
    [activeClass?.id, data.students]
  );

  if (!classes.length) {
    return (
      <div className="t-page">
        <PageHead
          backTo="/attendance"
          eyebrow="Monthly registry"
          title="Attendance history"
          subtitle="You are not currently the attendance incharge of a class."
        />
        <EmptyState
          icon={Users}
          title="No class register assigned"
          message="Ask the school office to make you the attendance incharge for your class."
        />
      </div>
    );
  }

  return (
    <div className="t-page attendance-registry-page">
      <PageHead
        backTo="/attendance"
        eyebrow="Monthly registry"
        title="Attendance history"
        subtitle={
          activeClass
            ? `${activeClass.displayName} · every student and every day of the month`
            : 'Monthly attendance'
        }
        action={<Badge tone="brand">One square = one day</Badge>}
      />

      <div className="class-pills" role="tablist" aria-label="Choose class">
        {classes.map((cls) => (
          <button
            key={cls.id}
            type="button"
            role="tab"
            aria-selected={cls.id === activeClass?.id}
            className={`class-pill ${cls.id === activeClass?.id ? 'active' : ''}`}
            onClick={() => setSection(cls.id)}
          >
            {cls.displayName}
          </button>
        ))}
      </div>

      <StudentAttendanceRegistry
        students={students}
        sessions={sessions}
        title={`${activeClass?.displayName || 'Class'} attendance`}
        subtitle="Each row is a student. Tap or hover a square for the exact status, and scroll sideways for the full month."
      />
    </div>
  );
}
