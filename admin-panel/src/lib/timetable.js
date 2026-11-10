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

export const TIMETABLE_DAY_OPTIONS = [1, 2, 3, 4, 5, 6].map((value) => ({
  value,
  label: WEEKDAYS[value],
  short: WEEKDAYS_SHORT[value],
}));

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function upcomingSundayISO(anchor = new Date()) {
  const date = new Date(anchor);
  const diff = (7 - date.getDay()) % 7;
  date.setDate(date.getDate() + diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

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
      startTime: String(period?.startTime || period?.start || ''),
      endTime: String(period?.endTime || period?.end || ''),
    }))
    .filter((period) => TIME_RE.test(period.startTime) && TIME_RE.test(period.endTime));
  return periods.length ? periods : DEFAULT_TIMETABLE_PERIODS.map((period) => ({ ...period }));
}

export function getTimetableConfig(data) {
  const meta = data?.meta || {};
  const days = normalizeTimetableDays(meta.timetableDays);
  const periods = normalizeTimetablePeriods(meta.timetablePeriods);
  const status = meta.timetableStatus === 'published' ? 'published' : 'draft';
  const editUntil = DATE_RE.test(String(meta.timetableEditUntil || ''))
    ? meta.timetableEditUntil
    : upcomingSundayISO();
  const windowOpen = status === 'draft' && todayISO() <= editUntil;
  return {
    days,
    dayOptions: TIMETABLE_DAY_OPTIONS.filter((day) => days.includes(day.value)),
    periods,
    status,
    editUntil,
    windowOpen,
    isEditable: windowOpen,
    publishedAt: meta.timetablePublishedAt || null,
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

export function timetableDayLabel(day) {
  return WEEKDAYS[day] || `Day ${day}`;
}

export function isTimeRangeValid(startTime, endTime) {
  return (
    TIME_RE.test(String(startTime || '')) &&
    TIME_RE.test(String(endTime || '')) &&
    startTime < endTime
  );
}
