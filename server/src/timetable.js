const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export const DEFAULT_TIMETABLE_DAYS = [1, 2, 3, 4, 5];
export const DEFAULT_TIMETABLE_PERIODS = [
  { periodNumber: 1, startTime: '08:30', endTime: '09:15' },
  { periodNumber: 2, startTime: '09:20', endTime: '10:05' },
  { periodNumber: 3, startTime: '10:15', endTime: '11:00' },
  { periodNumber: 4, startTime: '11:05', endTime: '11:50' },
  { periodNumber: 5, startTime: '12:30', endTime: '13:15' },
  { periodNumber: 6, startTime: '13:20', endTime: '14:05' },
];

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isoDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function upcomingSundayISO(anchor = new Date()) {
  const date = new Date(anchor);
  const diff = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + diff);
  return isoDate(date);
}

export function normalizeDays(value) {
  const days = Array.isArray(value)
    ? [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 6))]
    : [];
  return (days.length ? days : DEFAULT_TIMETABLE_DAYS).sort((a, b) => a - b);
}

export function normalizePeriods(value) {
  if (!Array.isArray(value) || !value.length) {
    return DEFAULT_TIMETABLE_PERIODS.map((period) => ({ ...period }));
  }
  const periods = value
    .map((period, index) => ({
      periodNumber: index + 1,
      startTime: String(period?.startTime || ''),
      endTime: String(period?.endTime || ''),
    }))
    .filter((period) => TIME_RE.test(period.startTime) && TIME_RE.test(period.endTime));
  return periods.length ? periods : DEFAULT_TIMETABLE_PERIODS.map((period) => ({ ...period }));
}

export function getTimetableConfig(db) {
  const meta = db?.meta || {};
  const days = normalizeDays(meta.timetableDays);
  const periods = normalizePeriods(meta.timetablePeriods);
  const status = meta.timetableStatus === 'published' ? 'published' : 'draft';
  const editUntil = DATE_RE.test(String(meta.timetableEditUntil || ''))
    ? meta.timetableEditUntil
    : upcomingSundayISO();
  const windowOpen = status === 'draft' && isoDate() <= editUntil;
  return {
    days,
    periods,
    status,
    editUntil,
    windowOpen,
    isEditable: windowOpen,
    publishedAt: meta.timetablePublishedAt || null,
  };
}

export function timeToMinutes(time) {
  if (!time) return 0;
  const [hours, minutes] = String(time).split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

export function timeRangesOverlap(startA, endA, startB, endB) {
  return timeToMinutes(startA) < timeToMinutes(endB) && timeToMinutes(startB) < timeToMinutes(endA);
}

export function validatePeriods(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    return { error: 'Choose between 1 and 10 periods per day.' };
  }
  const periods = value.map((period, index) => ({
    periodNumber: index + 1,
    startTime: String(period?.startTime || ''),
    endTime: String(period?.endTime || ''),
  }));
  for (const period of periods) {
    if (!TIME_RE.test(period.startTime) || !TIME_RE.test(period.endTime)) {
      return { error: `Period ${period.periodNumber} needs valid start and end times.` };
    }
    if (period.startTime >= period.endTime) {
      return { error: `Period ${period.periodNumber} must end after it starts.` };
    }
  }
  for (let i = 0; i < periods.length; i += 1) {
    for (let j = i + 1; j < periods.length; j += 1) {
      if (
        timeRangesOverlap(
          periods[i].startTime,
          periods[i].endTime,
          periods[j].startTime,
          periods[j].endTime
        )
      ) {
        return {
          error: `Period ${periods[i].periodNumber} overlaps period ${periods[j].periodNumber}.`,
        };
      }
    }
  }
  return { periods };
}

export function dayName(day) {
  return WEEKDAY_NAMES[day] || `Day ${day}`;
}

export function isDateString(value) {
  return DATE_RE.test(String(value || ''));
}

export { TIME_RE, DATE_RE };
