import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import Avatar from './Avatar';
import { compareRoll, formatDateLong, todayISO } from '../lib/format';

const STATUS_META = {
  present: { label: 'Present', className: 'present' },
  absent: { label: 'Absent', className: 'absent' },
  late: { label: 'Late', className: 'late' },
  excused: { label: 'Excused', className: 'excused' },
};

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, delta) {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date) {
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function toIso(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function StudentAttendanceRegistry({
  students = [],
  sessions = [],
  showClass = false,
  title = 'Student attendance registry',
  subtitle = 'One row per student, one square per day.',
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const key = monthKey(month);
  const today = todayISO();
  const currentMonth = startOfMonth(new Date());
  const isCurrentMonth = key === monthKey(currentMonth);

  const days = useMemo(() => {
    const totalDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
      const iso = toIso(date);
      return {
        day: index + 1,
        iso,
        weekday: date.toLocaleDateString('en-GB', { weekday: 'narrow' }),
        isToday: iso === today,
        isFuture: iso > today,
      };
    });
  }, [month, today]);

  const statusByStudent = useMemo(() => {
    const map = new Map();
    sessions
      .filter((session) => String(session.date || '').startsWith(key))
      .forEach((session) => {
        (session.entries || []).forEach((entry) => {
          if (!entry?.studentId) return;
          if (!map.has(entry.studentId)) map.set(entry.studentId, new Map());
          map.get(entry.studentId).set(session.date, entry.status);
        });
      });
    return map;
  }, [key, sessions]);

  const rows = useMemo(
    () =>
      students
        .map((student) => {
          const statuses = statusByStudent.get(student.id) || new Map();
          const counts = { present: 0, absent: 0, late: 0, excused: 0 };
          days.forEach((day) => {
            const status = statuses.get(day.iso);
            if (status && counts[status] !== undefined) counts[status] += 1;
          });
          const total = counts.present + counts.absent + counts.late + counts.excused;
          const rate = total
            ? Math.round(((counts.present + counts.late * 0.5) / total) * 1000) / 10
            : null;
          return { student, statuses, counts, total, rate };
        })
        .sort((a, b) => {
          const classDiff = String(a.student.classIdSection).localeCompare(
            String(b.student.classIdSection)
          );
          if (classDiff !== 0) return classDiff;
          return compareRoll(a.student.rollNumber, b.student.rollNumber);
        }),
    [days, statusByStudent, students]
  );

  const totalEntries = rows.reduce((sum, row) => sum + row.total, 0);
  const totalPresent = rows.reduce((sum, row) => sum + row.counts.present, 0);
  const totalLate = rows.reduce((sum, row) => sum + row.counts.late, 0);
  const averageRate = totalEntries
    ? Math.round(((totalPresent + totalLate * 0.5) / totalEntries) * 1000) / 10
    : 0;
  const tracked = rows.filter((row) => row.total > 0).length;
  const perfect = rows.filter((row) => row.total > 0 && row.rate >= 99.5).length;
  const atRisk = rows.filter((row) => row.total > 0 && row.rate < 75).length;

  return (
    <section className="student-registry">
      <div className="registry-head">
        <div>
          <span className="registry-eyebrow">
            <Users size={14} /> Monthly registry
          </span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="registry-nav">
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth((current) => addMonths(current, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={17} />
          </button>
          <strong>{monthLabel(month)}</strong>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            aria-label="Next month"
            disabled={isCurrentMonth}
          >
            <ChevronRight size={17} />
          </button>
          <button
            type="button"
            className="registry-today"
            onClick={() => setMonth(startOfMonth(new Date()))}
          >
            Today
          </button>
        </div>
      </div>

      <div className="registry-summary">
        <div>
          <span>Average rate</span>
          <strong>{averageRate}%</strong>
          <small>{totalEntries} marked entries</small>
        </div>
        <div>
          <span>Students tracked</span>
          <strong>{tracked}</strong>
          <small>of {rows.length} students</small>
        </div>
        <div>
          <span>Perfect attendance</span>
          <strong>{perfect}</strong>
          <small>100% this month</small>
        </div>
        <div>
          <span>Below 75%</span>
          <strong className={atRisk ? 'danger-text' : 'success-text'}>{atRisk}</strong>
          <small>follow-up needed</small>
        </div>
      </div>

      <div className="registry-table-wrap">
        <table className="registry-table">
          <thead>
            <tr>
              <th className="registry-name-head">Student</th>
              {days.map((day) => (
                <th
                  key={day.iso}
                  className={`registry-day-head ${day.isToday ? 'today' : ''}`}
                >
                  <span>{day.weekday}</span>
                  <small>{day.day}</small>
                </th>
              ))}
              <th className="registry-rate-head">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ student, statuses, counts, total, rate }) => (
              <tr key={student.id}>
                <td className="registry-name-cell">
                  <div className="registry-student">
                    <Avatar name={student.name} size={30} />
                    <span>
                      <strong>{student.name}</strong>
                      <small>
                        Roll {student.rollNumber}
                        {showClass ? ` · ${student.classIdSection}` : ''}
                      </small>
                    </span>
                  </div>
                </td>
                {days.map((day) => {
                  const status = statuses.get(day.iso);
                  const meta = status ? STATUS_META[status] : null;
                  return (
                    <td
                      key={day.iso}
                      className={`registry-day-cell ${meta ? `status-${meta.className}` : 'status-none'} ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}`}
                    >
                      <span
                        className="registry-square"
                        title={`${formatDateLong(day.iso, { year: 'numeric' })} · ${meta?.label || 'No register'}`}
                      />
                    </td>
                  );
                })}
                <td className="registry-rate-cell">
                  <strong>{rate === null ? '—' : `${rate}%`}</strong>
                  <small>{counts.present}/{total} present</small>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="registry-legend">
        <span><i className="registry-swatch present" /> Present</span>
        <span><i className="registry-swatch late" /> Late</span>
        <span><i className="registry-swatch excused" /> Excused</span>
        <span><i className="registry-swatch absent" /> Absent</span>
        <span><i className="registry-swatch none" /> No register</span>
      </div>

      {!rows.length ? (
        <div className="registry-empty">No students match the current filter.</div>
      ) : null}
      {rows.length && !tracked ? (
        <div className="registry-note">
          No attendance registers were submitted for {monthLabel(month)}.
        </div>
      ) : null}
      <p className="registry-scroll-note">Scroll sideways to see every day in the month.</p>
    </section>
  );
}
