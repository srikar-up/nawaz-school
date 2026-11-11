/**
 * Attendance mode rules.
 *
 * The server and both PWAs carry a copy of these helpers; the parity test keeps
 * them from drifting apart.
 *
 *   node --test server/test/attendance-mode.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as server from '../src/attendance-mode.js';
import * as teacher from '../../teacher-app/src/lib/attendance.js';
import * as admin from '../../admin-panel/src/lib/attendance.js';

test('missing or unknown meta defaults to two sessions', () => {
  assert.equal(server.attendanceModeOf({}), 'twoSessions');
  assert.equal(server.attendanceModeOf(undefined), 'twoSessions');
  assert.equal(server.attendanceModeOf({ attendanceMode: 'weekly' }), 'twoSessions');
});

test('full-day mode is detected', () => {
  assert.equal(server.attendanceModeOf({ attendanceMode: 'fullDay' }), 'fullDay');
});

test('session types follow the mode', () => {
  assert.deepEqual(server.sessionTypesFor('twoSessions'), ['Morning', 'Afternoon']);
  assert.deepEqual(server.sessionTypesFor('fullDay'), ['FullDay']);
  assert.deepEqual(server.sessionTypesFor('nonsense'), ['Morning', 'Afternoon']);
});

test('the default session type is the first one in the mode', () => {
  assert.equal(server.primarySessionType('twoSessions'), 'Morning');
  assert.equal(server.primarySessionType('fullDay'), 'FullDay');
});

test('session types are only allowed in the matching mode', () => {
  assert.equal(server.isSessionTypeAllowed('twoSessions', 'Morning'), true);
  assert.equal(server.isSessionTypeAllowed('twoSessions', 'Afternoon'), true);
  assert.equal(server.isSessionTypeAllowed('twoSessions', 'FullDay'), false);

  assert.equal(server.isSessionTypeAllowed('fullDay', 'FullDay'), true);
  assert.equal(server.isSessionTypeAllowed('fullDay', 'Morning'), false);
  assert.equal(server.isSessionTypeAllowed('fullDay', 'Afternoon'), false);
});

test('attendance mode parsing rejects unsupported values', () => {
  assert.equal(server.parseAttendanceMode('twoSessions'), 'twoSessions');
  assert.equal(server.parseAttendanceMode('fullDay'), 'fullDay');
  assert.equal(server.parseAttendanceMode(''), null);
  assert.equal(server.parseAttendanceMode('FullDay'), null);
  assert.equal(server.parseAttendanceMode(undefined), null);
});

test('labels are human readable', () => {
  assert.equal(server.sessionTypeLabel('FullDay'), 'Full day');
  assert.equal(server.sessionTypeLabel('Morning'), 'Morning');
  assert.equal(server.sessionTypeLabel('Afternoon'), 'Afternoon');
});

for (const [name, helper] of [
  ['teacher', teacher],
  ['admin', admin],
]) {
  test(`${name} helper matches the server rules`, () => {
    for (const meta of [{}, { attendanceMode: 'twoSessions' }, { attendanceMode: 'fullDay' }]) {
      const mode = helper.attendanceModeOf(meta);
      assert.equal(mode, server.attendanceModeOf(meta));
      assert.deepEqual(helper.sessionTypesFor(mode), server.sessionTypesFor(mode));
      assert.equal(helper.primarySessionType(mode), server.primarySessionType(mode));
      for (const type of ['Morning', 'Afternoon', 'FullDay', 'Evening']) {
        assert.equal(
          helper.isSessionTypeAllowed(mode, type),
          server.isSessionTypeAllowed(mode, type)
        );
        assert.equal(helper.sessionTypeLabel(type), server.sessionTypeLabel(type));
      }
    }
  });
}
