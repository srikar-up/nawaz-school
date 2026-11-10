import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarDays,
  Clock3,
  MapPin,
  School,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import Badge from '../components/Badge';
import EmptyState from '../components/EmptyState';
import PageHead from '../components/PageHead';
import {
  classLabel,
  formatDateLong,
  formatTime,
  timeToMinutes,
} from '../lib/format';
import { getTimetableConfig, weekDatesForDays } from '../lib/timetable';

export default function Timetable() {
  const { data, user } = useAppData();
  const timetableConfig = useMemo(() => getTimetableConfig(data), [data]);
  const dates = useMemo(
    () => weekDatesForDays(timetableConfig.days),
    [timetableConfig.days]
  );
  const currentDay = new Date().getDay();
  const initialDay = timetableConfig.days.includes(currentDay)
    ? currentDay
    : timetableConfig.days[0];
  const [day, setDay] = useState(initialDay);
  const [scope, setScope] = useState('mine');

  useEffect(() => {
    if (!timetableConfig.days.includes(day)) {
      setDay(timetableConfig.days[0]);
    }
  }, [day, timetableConfig.days]);
  const selectedDate = dates.find((entry) => entry.value === day);
  const isToday = selectedDate?.isToday;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const myPeriods = data.timetable
    .filter((period) => period.teacherStaffId === user.id && period.dayOfWeek === day)
    .sort((a, b) => a.periodNumber - b.periodNumber);
  const allPeriods = data.timetable
    .filter((period) => period.dayOfWeek === day)
    .sort((a, b) =>
      a.classIdSection.localeCompare(b.classIdSection) ||
      a.periodNumber - b.periodNumber
    );

  const periodsByClass = data.classes.map((cls) => ({
    cls,
    periods: allPeriods.filter((period) => period.classIdSection === cls.id),
  }));

  return (
    <div className="t-page">
      <PageHead
        backTo="/more"
        eyebrow="Weekly schedule"
        title="Timetable"
        subtitle={selectedDate ? formatDateLong(selectedDate.date, { year: 'numeric' }) : ''}
        action={isToday ? <Badge tone="brand" icon={Sparkles}>Today</Badge> : null}
      />

      <div className="week-strip" role="tablist" aria-label="Choose day">
        {dates.map((entry) => (
          <button
            key={entry.value}
            type="button"
            role="tab"
            aria-selected={entry.value === day}
            className={`week-day ${entry.value === day ? 'active' : ''} ${entry.isToday ? 'today' : ''}`}
            onClick={() => setDay(entry.value)}
          >
            <span>{entry.label}</span>
            <strong>{entry.date.getDate()}</strong>
            {entry.isToday ? <i /> : null}
          </button>
        ))}
      </div>

      <div className="segmented segmented-2">
        <button
          type="button"
          className={scope === 'mine' ? 'active' : ''}
          onClick={() => setScope('mine')}
        >
          My schedule
        </button>
        <button
          type="button"
          className={scope === 'all' ? 'active' : ''}
          onClick={() => setScope('all')}
        >
          Whole school
        </button>
      </div>

      {scope === 'mine' ? (
        <>
          <div className="scope-strip">
            <span>
              <CalendarDays size={15} /> {myPeriods.length} periods on {selectedDate?.label}
            </span>
            <span>{data.timetable.filter((period) => period.teacherStaffId === user.id).length} this week</span>
          </div>

          {myPeriods.length ? (
            <div className="timeline-list">
              {myPeriods.map((period) => {
                const live =
                  isToday &&
                  nowMinutes >= timeToMinutes(period.startTime) &&
                  nowMinutes <= timeToMinutes(period.endTime);
                const done =
                  isToday && nowMinutes > timeToMinutes(period.endTime);
                return (
                  <article
                    key={period.id}
                    className={`timeline-period ${live ? 'live' : ''} ${done ? 'done' : ''}`}
                  >
                    <div className="timeline-time">
                      <strong>{formatTime(period.startTime).replace(' ', '')}</strong>
                      <span>{formatTime(period.endTime).replace(' ', '')}</span>
                    </div>
                    <div className="timeline-rail">
                      <span className="timeline-dot" />
                    </div>
                    <div className="timeline-card">
                      <div className="timeline-card-top">
                        <h3>{period.subject}</h3>
                        {live ? (
                          <Badge tone="success" icon={Sparkles}>
                            Live now
                          </Badge>
                        ) : done ? (
                          <Badge tone="neutral">Done</Badge>
                        ) : (
                          <Badge tone="brand">Period {period.periodNumber}</Badge>
                        )}
                      </div>
                      <div className="timeline-meta">
                        <span>
                          <Users size={13} /> {classLabel(data, period.classIdSection)}
                        </span>
                        <span>
                          <MapPin size={13} /> {period.room}
                        </span>
                        {period.isLab ? <span className="lab-tag">Lab</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="A free day"
              message="You have no scheduled periods on this day."
            />
          )}
        </>
      ) : (
        <div className="whole-school">
          {periodsByClass.map(({ cls, periods }) => (
            <section key={cls.id} className="card school-class-card">
              <div className="school-class-head">
                <span className="class-avatar small">
                  <School size={17} />
                </span>
                <div>
                  <h3>{cls.displayName}</h3>
                  <span>{periods.length} periods · {cls.room}</span>
                </div>
              </div>
              <div className="school-periods">
                {periods.map((period) => (
                  <div key={period.id} className="school-period-row">
                    <span className="school-period-time">{formatTime(period.startTime).replace(' ', '')}</span>
                    <span className="school-period-subject">
                      <strong>{period.subject}</strong>
                      <small>{period.teacherName} · {period.room}</small>
                    </span>
                    <span className="school-period-number">P{period.periodNumber}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="timetable-note">
        <Clock3 size={15} />
        <span>
          Times use the school’s local timezone. Live periods are highlighted today only.
        </span>
      </div>
    </div>
  );
}
