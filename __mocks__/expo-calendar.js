/**
 * Jest mock for `expo-calendar` (a native module — not loadable in the jest
 * environment). The pure normalization/date logic is tested directly against
 * `calendar-normalizer.ts` and needs no mock; this exists so any test that
 * transitively imports the calendar service/hook doesn't crash on the native
 * module. Tests that exercise these paths should `jest.spyOn` the specific
 * functions they need.
 */

const EntityTypes = { EVENT: 'event', REMINDER: 'reminder' };

const granted = { status: 'granted', granted: true, canAskAgain: true, expires: 'never' };

module.exports = {
  EntityTypes,
  getCalendarPermissions: jest.fn(async () => granted),
  requestCalendarPermissions: jest.fn(async () => granted),
  getCalendars: jest.fn(async () => []),
  listEvents: jest.fn(async () => []),
};
