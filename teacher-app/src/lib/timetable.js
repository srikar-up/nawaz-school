import { WEEKDAYS, WEEKDAYS_SHORT, todayISO } from './format';

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

export function normalizeTimetableDays(value) {
  const days = Array.isArray(value)
    ? [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 6))]
    : [];
  return (days.length ? days : DEFAULT_TIMETABLE_DAYS).sort((a, b) => a - b);
}

export function normalizeTimetablePeriods(value) {
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

export function getTimetableConfig(data) {
  const meta = data?.meta || {};
  return {
    days: normalizeTimetableDays(meta.timetableDays),
    periods: normalizeTimetablePeriods(meta.timetablePeriods),
  };
}

export function weekDatesForDays(days, anchor = new Date()) {
  const monday = new Date(anchor);
  const diff = monday.getDay() === 0 ? -6 : 1 - monday.getDay();
  monday.setDate(monday.getDate() + diff);
  return days.map((day) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + day - 1);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      value: day,
      label: WEEKDAYS[day],
      short: WEEKDAYS_SHORT[day],
      date,
      iso,
      isToday: iso === todayISO(),
    };
  });
}
