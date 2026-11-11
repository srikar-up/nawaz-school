import { useMemo } from 'react';
import {
  Award,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  Printer,
  Sparkles,
  TriangleAlert,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { DonutChart, GroupedBarChart, LineChart } from '../components/Charts';
import {
  attendanceStats,
  classLabel,
  downloadCsv,
  findSession,
  formatDateLong,
  gradeLetter,
  isStudentAtRisk,
  overallAttendanceForDate,
  schoolDaysBack,
  studentAttendance,
  studentAverage,
  studentScores,
  todayISO,
} from '../lib/format';

const GRADE_COLORS = {
  'A+': '#4338CA',
  A: '#6366F1',
  B: '#0D9488',
  C: '#38BDF8',
  D: '#FACC15',
  E: '#FB923C',
  F: '#EF4444',
};
const CLASS_COLORS = ['#4338CA', '#0D9488', '#FACC15', '#F472B6'];
const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'E', 'F'];

export default function Reports() {
  const { data, notify } = useAppData();
  const today = todayISO();
  const attendance = overallAttendanceForDate(data, today);
  const riskStudents = data.students
    .filter((student) => isStudentAtRisk(data, student.id))
    .map((student) => ({
      ...student,
      average: studentAverage(data, student.id),
      attendance: studentAttendance(data, student.id),
      scores: studentScores(data, student.id),
    }))
    .sort((a, b) => (a.average || 0) - (b.average || 0));
  const schoolAverage = data.testRecords.length
    ? Math.round(
        (data.testRecords.reduce((sum, record) => sum + record.percentage, 0) /
          data.testRecords.length) *
          10
      ) / 10
    : 0;
  const attendanceTrend = schoolDaysBack(14).map((date) => {
    const stats = overallAttendanceForDate(data, date);
    return {
      label: new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      }),
      value: stats.rate,
    };
  });
  const enrollment = data.classes.map((cls, index) => ({
    label: cls.displayName,
    value: data.students.filter((student) => student.classIdSection === cls.id).length,
    color: CLASS_COLORS[index % CLASS_COLORS.length],
  }));
  const classComparison = data.classes.map((cls) => {
    const session = findSession(data, cls.id, today);
    const stats = session ? attendanceStats(session.entries) : null;
    return {
      label: cls.id,
      present: stats?.present || 0,
      absent: stats ? stats.absent + stats.late + stats.excused : cls.studentCount,
      rate: stats?.rate || 0,
    };
  });
  const subjectPerformance = useMemo(() => {
    const subjects = {};
    data.testRecords.forEach((record) => {
      if (!subjects[record.subject]) subjects[record.subject] = [];
      subjects[record.subject].push(record.percentage);
    });
    return Object.entries(subjects)
      .map(([subject, values]) => ({
        subject,
        average: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10,
        count: values.length,
      }))
      .sort((a, b) => b.average - a.average);
  }, [data.testRecords]);
  const gradeDistribution = useMemo(() => {
    return GRADE_ORDER.map((grade) => ({
      label: grade,
      value: data.testRecords.filter((record) => gradeLetter(record.percentage) === grade).length,
      color: GRADE_COLORS[grade],
    }));
  }, [data.testRecords]);
  const submittedExams = data.exams.filter((exam) => exam.marksStatus === 'Submitted');
  const submittedClasses = data.classes.filter((cls) => findSession(data, cls.id, today));
  const topClass = [...classComparison].sort((a, b) => b.rate - a.rate)[0];

  const exportSummary = () => {
    const rows = data.classes.map((cls) => {
      const session = findSession(data, cls.id, today);
      const stats = session ? attendanceStats(session.entries) : null;
      const roster = data.students.filter((student) => student.classIdSection === cls.id);
      const averages = roster
        .map((student) => studentAverage(data, student.id))
        .filter((value) => value !== null);
      return [
        cls.id,
        cls.displayName,
        cls.classTeacherName,
        roster.length,
        stats?.rate ?? '',
        stats?.present ?? '',
        stats?.absent ?? '',
        averages.length
          ? Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 10) / 10
          : '',
      ];
    });
    downloadCsv(
      `nawaz-school-summary-${today}.csv`,
      [
        'class_id',
        'class_name',
        'class_teacher',
        'students',
        'attendance_rate',
        'present',
        'absent',
        'average_assessment',
      ],
      rows
    );
    notify('School summary exported.', 'success');
  };

  return (
    <div className="admin-page reports-page printable-report">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        subtitle={`A live picture of attendance, assessment and school performance · ${data.meta.academicYear}`}
        actions={
          <>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={exportSummary}>
              <Download size={16} /> Export summary
            </button>
            <button type="button" className="admin-btn admin-btn-primary" onClick={() => window.print()}>
              <Printer size={16} /> Print report
            </button>
          </>
        }
      />

      <div className="report-print-head">
        <div>
          <strong>{data.meta.schoolName}</strong>
          <span>Executive summary · {formatDateLong(new Date())}</span>
        </div>
        <span>Generated from live school records</span>
      </div>

      <div className="stat-grid">
        <StatCard
          label="Attendance today"
          value={`${attendance.rate}%`}
          icon={CalendarDays}
          tone="mint"
          trend={`${submittedClasses.length}/${data.classes.length} registers`}
          hint={`${topClass?.label || '—'} leading at ${topClass?.rate || 0}%`}
          sparkline={attendanceTrend.slice(-7).map((entry) => entry.value)}
          sparkColor="#0D9488"
        />
        <StatCard
          label="School average"
          value={`${schoolAverage}%`}
          icon={Award}
          tone="lavender"
          trend={`${data.testRecords.length} score records`}
          hint="Across all submitted assessments"
        />
        <StatCard
          label="Students at risk"
          value={riskStudents.length}
          icon={TriangleAlert}
          tone="rose"
          trend={riskStudents.length ? 'Needs support' : 'All clear'}
          trendDirection={riskStudents.length ? 'down' : 'up'}
          hint="Below 35% assessment average"
        />
        <StatCard
          label="Results submitted"
          value={`${submittedExams.length}/${data.exams.length}`}
          icon={CheckCircle2}
          tone="yellow"
          trend={`${data.exams.length - submittedExams.length} in progress`}
          hint="Assessments with completed marks"
        />
      </div>

      <div className="reports-grid">
        <section className="admin-card report-chart-wide">
          <div className="admin-card-head">
            <div>
              <h2>Attendance trend</h2>
              <p>School-wide attendance rate over the last fourteen school days</p>
            </div>
            <div className="admin-card-head-stat">
              <strong>{attendance.rate}%</strong>
              <span>today</span>
            </div>
          </div>
          <LineChart
            data={attendanceTrend}
            height={270}
            maxValue={100}
            color="#0D9488"
            suffix="%"
            ariaLabel="Fourteen day attendance trend"
          />
        </section>

        <section className="admin-card report-enrollment">
          <div className="admin-card-head">
            <div>
              <h2>Enrollment by class</h2>
              <p>{data.students.length} students</p>
            </div>
            <Users size={18} className="muted-icon" />
          </div>
          <div className="donut-section">
            <DonutChart
              data={enrollment}
              size={190}
              thickness={26}
              centerValue={data.students.length}
              centerLabel="students"
              ariaLabel="Enrollment by class"
            />
            <div className="donut-legend">
              {enrollment.map((entry) => (
                <span key={entry.label}>
                  <i style={{ background: entry.color }} />
                  {entry.label}
                  <strong>{entry.value}</strong>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-card report-comparison">
          <div className="admin-card-head">
            <div>
              <h2>Class attendance comparison</h2>
              <p>Present and absent students for today’s morning register</p>
            </div>
            <Badge tone="brand">{formatDateLong(new Date(), { year: undefined })}</Badge>
          </div>
          <GroupedBarChart
            data={classComparison}
            series={[
              { key: 'present', label: 'Present', color: '#4338CA' },
              { key: 'absent', label: 'Absent / leave', color: '#FACC15' },
            ]}
            maxValue={Math.ceil(Math.max(10, ...classComparison.map((row) => Math.max(row.present, row.absent))) / 10) * 10}
            height={240}
            ariaLabel="Attendance by class"
          />
        </section>

        <section className="admin-card report-subjects">
          <div className="admin-card-head">
            <div>
              <h2>Subject performance</h2>
              <p>Average score across submitted assessments</p>
            </div>
            <BarChart3 size={18} className="muted-icon" />
          </div>
          <div className="subject-performance-list">
            {subjectPerformance.map((subject) => (
              <div key={subject.subject} className="subject-performance-row">
                <div className="subject-performance-label">
                  <strong>{subject.subject}</strong>
                  <span>{subject.count} scores</span>
                </div>
                <div className="subject-performance-bar">
                  <i
                    style={{
                      width: `${subject.average}%`,
                      background:
                        subject.average < 50 ? '#EF4444' : subject.average < 65 ? '#FACC15' : '#0D9488',
                    }}
                  />
                </div>
                <strong>{subject.average}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-card report-grades">
          <div className="admin-card-head">
            <div>
              <h2>Grade distribution</h2>
              <p>All submitted score records</p>
            </div>
            <Sparkles size={18} className="muted-icon" />
          </div>
          <div className="donut-section compact">
            <DonutChart
              data={gradeDistribution}
              size={170}
              thickness={24}
              centerValue={data.testRecords.length}
              centerLabel="scores"
              ariaLabel="Grade distribution"
            />
            <div className="grade-legend vertical">
              {gradeDistribution.map((grade) => (
                <span key={grade.label}>
                  <i style={{ background: grade.color }} />
                  {grade.label}
                  <strong>{grade.value}</strong>
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="reports-bottom-grid">
        <section className="admin-card report-risk-table">
          <div className="admin-card-head">
            <div>
              <h2>Students needing support</h2>
              <p>Below the 35% average threshold</p>
            </div>
            <Badge tone={riskStudents.length ? 'danger' : 'success'}>
              {riskStudents.length} flagged
            </Badge>
          </div>
          {riskStudents.length ? (
            <div className="table-scroll">
              <table className="admin-table compact-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Average</th>
                    <th>Attendance</th>
                    <th>Assessments</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {riskStudents.map((student) => (
                    <tr key={student.id}>
                      <td>
                        <span className="table-person muted-person">
                          <Avatar name={student.name} size={30} photo={student.photo} />
                          <span>
                            <strong>{student.name}</strong>
                            <small>Roll {student.rollNumber}</small>
                          </span>
                        </span>
                      </td>
                      <td>{student.classIdSection}</td>
                      <td>
                        <strong>{student.average !== null ? `${Math.round(student.average)}%` : '—'}</strong>
                      </td>
                      <td>{student.attendance.rate}%</td>
                      <td>{student.scores.length}</td>
                      <td>
                        <Badge tone="danger">Needs support</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-positive">
              <CheckCircle2 size={20} />
              <div>
                <strong>Every student is above the risk line</strong>
                <span>Keep reviewing assessment data each term.</span>
              </div>
            </div>
          )}
        </section>

        <section className="admin-card executive-summary">
          <div className="admin-card-head">
            <div>
              <h2>Executive summary</h2>
              <p>Plain-language notes for the board</p>
            </div>
            <Badge tone="brand">Live</Badge>
          </div>
          <div className="executive-notes">
            <p>
              <strong>{attendance.rate}%</strong> of students were marked present today across{' '}
              {submittedClasses.length} of {data.classes.length} classes. Overall attendance this
              fortnight is {Math.round(
                attendanceTrend.reduce((sum, entry) => sum + entry.value, 0) /
                  Math.max(1, attendanceTrend.length)
              )}%.
            </p>
            <p>
              The school assessment average is <strong>{schoolAverage}%</strong>. {riskStudents.length}{' '}
              student{riskStudents.length === 1 ? '' : 's'} are below the 35% support threshold and
              should be reviewed with their class teachers.
            </p>
            <p>
              {submittedExams.length} of {data.exams.length} assessments have complete results.
              The best-attending class today is <strong>{topClass?.label || '—'}</strong> at{' '}
              {topClass?.rate || 0}%.
            </p>
          </div>
          <div className="executive-foot">
            <span>
              <CalendarDays size={14} /> {formatDateLong(new Date())}
            </span>
            <span>
              <Users size={14} /> {data.students.length} students · {data.staff.length} staff
            </span>
          </div>
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-block" onClick={() => window.print()}>
            <Printer size={16} /> Print this report
          </button>
        </section>
      </div>
    </div>
  );
}
