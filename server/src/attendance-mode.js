/**
 * Attendance mode.
 *
 * Schools either keep two registers a day (morning and afternoon) or a single
 * full-day register. The mode lives on `meta.attendanceMode` and is the only
 * source of truth for which session types may be submitted.
 */
export const DEFAULT_ATTENDANCE_MODE = 'twoSessions';

export const SESSION_TYPES = Object.freeze({
  twoSessions: ['Morning', 'Afternoon'],
  fullDay: ['FullDay'],
});

export const SESSION_LABELS = Object.freeze({
  Morning: 'Morning',
  Afternoon: 'Afternoon',
  FullDay: 'Full day',
});

export function attendanceModeOf(meta) {
  return meta?.attendanceMode === 'fullDay' ? 'fullDay' : DEFAULT_ATTENDANCE_MODE;
}

export function sessionTypesFor(mode) {
  return SESSION_TYPES[mode] || SESSION_TYPES[DEFAULT_ATTENDANCE_MODE];
}

/** The session type a teacher opens by default. */
export function primarySessionType(mode) {
  return sessionTypesFor(mode)[0];
}

export function sessionTypeLabel(sessionType) {
  return SESSION_LABELS[sessionType] || sessionType;
}

export function isSessionTypeAllowed(mode, sessionType) {
  return sessionTypesFor(mode).includes(sessionType);
}

/** Returns a valid mode, or null when the value is not one we support. */
export function parseAttendanceMode(value) {
  if (value === 'twoSessions' || value === 'fullDay') return value;
  return null;
}
