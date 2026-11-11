/**
 * Attendance mode helpers for the admin console.
 *
 * Kept in sync with server/src/attendance-mode.js.
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

export function primarySessionType(mode) {
  return sessionTypesFor(mode)[0];
}

export function sessionTypeLabel(sessionType) {
  return SESSION_LABELS[sessionType] || sessionType;
}

export function isSessionTypeAllowed(mode, sessionType) {
  return sessionTypesFor(mode).includes(sessionType);
}
