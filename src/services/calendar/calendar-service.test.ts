/**
 * Service-orchestration tests. `expo-calendar` is mocked
 * (moduleNameMapper -> __mocks__/expo-calendar.js); each test sets the raw data
 * the native layer would return and asserts we hand back normalized, filtered,
 * sorted models — and never crash on incomplete data.
 */

import * as Calendar from 'expo-calendar';

import { getEventCalendars, getTodayEvents, getUpcomingEvents } from '@/services/calendar/calendar-service';

const mockGetCalendars = Calendar.getCalendars as jest.Mock;
const mockListEvents = Calendar.listEvents as jest.Mock;

const NOW = new Date(2026, 8, 6, 10, 0);
const iso = (...args: [number, number, number, number, number]) => new Date(...args).toISOString();

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCalendars.mockResolvedValue([
    { id: 'cal-work', title: 'Work', color: '#f00', allowsModifications: true, source: { name: 'iCloud' } },
    { id: 'cal-personal', title: 'Personal', source: { name: 'Local' } },
  ]);
  mockListEvents.mockResolvedValue([]);
});

describe('getEventCalendars', () => {
  it('normalizes calendars', async () => {
    expect(await getEventCalendars()).toEqual([
      { id: 'cal-work', title: 'Work', source: 'iCloud', color: '#f00', allowsModifications: true },
      { id: 'cal-personal', title: 'Personal', source: 'Local', color: null, allowsModifications: false },
    ]);
  });
});

describe('getTodayEvents', () => {
  it('returns [] when the device has no calendars (never calls listEvents)', async () => {
    mockGetCalendars.mockResolvedValue([]);
    expect(await getTodayEvents(NOW)).toEqual([]);
    expect(mockListEvents).not.toHaveBeenCalled();
  });

  it('normalizes, keeps today-overlapping events, drops finished ones, and sorts', async () => {
    mockListEvents.mockResolvedValue([
      { id: 'later', calendarId: 'cal-work', title: 'Study', startDate: iso(2026, 8, 6, 15, 0), endDate: iso(2026, 8, 6, 16, 0), allDay: false },
      { id: 'earlier', calendarId: 'cal-work', title: 'Standup', startDate: iso(2026, 8, 6, 9, 0), endDate: iso(2026, 8, 6, 9, 15), allDay: false },
      { id: 'yesterday', calendarId: 'cal-work', title: 'Gym', startDate: iso(2026, 8, 5, 7, 0), endDate: iso(2026, 8, 5, 8, 0), allDay: false },
    ]);
    const events = await getTodayEvents(NOW);
    expect(events.map((e) => e.title)).toEqual(['Standup', 'Study']);
    expect(events[0]).toMatchObject({ source: 'device_calendar', isAllDay: false });
  });

  it('queries all event calendars, one day back to catch midnight-spanning events', async () => {
    await getTodayEvents(NOW);
    const [ids, from, to] = mockListEvents.mock.calls[0];
    expect(ids).toEqual(['cal-work', 'cal-personal']);
    expect((to as Date).getTime() - (from as Date).getTime()).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it('skips events with unusable data rather than crashing', async () => {
    mockListEvents.mockResolvedValue([
      { id: 'ok', calendarId: 'c', title: 'Real', startDate: iso(2026, 8, 6, 11, 0), endDate: iso(2026, 8, 6, 12, 0) },
      { id: 'broken', calendarId: 'c', title: null, startDate: null, endDate: null },
      { calendarId: 'c', title: 'No id', startDate: iso(2026, 8, 6, 13, 0), endDate: iso(2026, 8, 6, 14, 0) },
    ]);
    const events = await getTodayEvents(NOW);
    expect(events.map((e) => e.title)).toEqual(['Real']);
  });
});

describe('getUpcomingEvents', () => {
  it('keeps only events starting within the window, sorted', async () => {
    mockListEvents.mockResolvedValue([
      { id: 'far', calendarId: 'c', title: 'Far off', startDate: iso(2026, 8, 20, 9, 0), endDate: iso(2026, 8, 20, 10, 0) },
      { id: 'soon', calendarId: 'c', title: 'Tomorrow', startDate: iso(2026, 8, 7, 9, 0), endDate: iso(2026, 8, 7, 10, 0) },
      { id: 'past', calendarId: 'c', title: 'Earlier today', startDate: iso(2026, 8, 6, 8, 0), endDate: iso(2026, 8, 6, 9, 0) },
    ]);
    expect((await getUpcomingEvents(NOW, 7)).map((e) => e.title)).toEqual(['Tomorrow']);
  });
});
