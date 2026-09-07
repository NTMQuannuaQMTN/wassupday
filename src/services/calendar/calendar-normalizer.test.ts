import {
  filterTodayEvents,
  filterUpcomingEvents,
  localDayRange,
  normalizeCalendar,
  normalizeEvent,
  sortByStart,
  toDomainEvent,
  upcomingRange,
  type RawExpoEvent,
} from '@/services/calendar/calendar-normalizer';
import type { DeviceCalendarEvent } from '@/services/calendar/types';

const NOW = new Date(2026, 8, 6, 10, 0); // Sun 2026-09-06, 10:00 local

function rawEvent(overrides: Partial<RawExpoEvent> = {}): RawExpoEvent {
  return {
    id: 'evt-1',
    calendarId: 'cal-1',
    title: 'Team Meeting',
    startDate: new Date(2026, 8, 6, 11, 0).toISOString(),
    endDate: new Date(2026, 8, 6, 12, 0).toISOString(),
    allDay: false,
    location: 'Room 3',
    notes: 'Bring the deck',
    ...overrides,
  };
}

function normalized(overrides: Partial<DeviceCalendarEvent> = {}): DeviceCalendarEvent {
  return {
    id: 'e',
    externalId: 'e',
    calendarId: 'cal-1',
    title: 'Event',
    startDate: new Date(2026, 8, 6, 11, 0).toISOString(),
    endDate: new Date(2026, 8, 6, 12, 0).toISOString(),
    location: null,
    notes: null,
    isAllDay: false,
    source: 'device_calendar',
    ...overrides,
  };
}

describe('normalizeEvent', () => {
  it('maps a well-formed raw event', () => {
    expect(normalizeEvent(rawEvent())).toEqual({
      id: 'evt-1',
      externalId: 'evt-1',
      calendarId: 'cal-1',
      title: 'Team Meeting',
      startDate: new Date(2026, 8, 6, 11, 0).toISOString(),
      endDate: new Date(2026, 8, 6, 12, 0).toISOString(),
      location: 'Room 3',
      notes: 'Bring the deck',
      isAllDay: false,
      source: 'device_calendar',
    });
  });

  it('accepts Date objects for start/end', () => {
    const e = normalizeEvent(rawEvent({ startDate: new Date(2026, 8, 6, 9, 0), endDate: new Date(2026, 8, 6, 10, 0) }));
    expect(e?.startDate).toBe(new Date(2026, 8, 6, 9, 0).toISOString());
  });

  it('falls back safely for a missing/blank title', () => {
    expect(normalizeEvent(rawEvent({ title: null }))?.title).toBe('Untitled event');
    expect(normalizeEvent(rawEvent({ title: '   ' }))?.title).toBe('Untitled event');
  });

  it('nulls out blank location and notes', () => {
    const e = normalizeEvent(rawEvent({ location: '  ', notes: undefined }));
    expect(e?.location).toBeNull();
    expect(e?.notes).toBeNull();
  });

  it('returns null when the start date is missing or invalid', () => {
    expect(normalizeEvent(rawEvent({ startDate: null }))).toBeNull();
    expect(normalizeEvent(rawEvent({ startDate: 'not-a-date' }))).toBeNull();
  });

  it('returns null when there is no usable id', () => {
    expect(normalizeEvent(rawEvent({ id: undefined, instanceId: undefined }))).toBeNull();
  });

  it('uses instanceId as the id when id is absent (recurring instance on Android)', () => {
    const e = normalizeEvent(rawEvent({ id: undefined, instanceId: 'inst-9' }));
    expect(e?.id).toBe('inst-9');
  });

  it('clamps an end that is before the start to the start (zero-length)', () => {
    const e = normalizeEvent(
      rawEvent({
        startDate: new Date(2026, 8, 6, 12, 0).toISOString(),
        endDate: new Date(2026, 8, 6, 11, 0).toISOString(),
      }),
    );
    expect(e?.endDate).toBe(e?.startDate);
  });

  it('marks all-day events', () => {
    expect(normalizeEvent(rawEvent({ allDay: true }))?.isAllDay).toBe(true);
  });
});

describe('normalizeCalendar', () => {
  it('maps a raw calendar and reads the source name', () => {
    expect(
      normalizeCalendar({ id: 'c1', title: 'Work', color: '#f00', allowsModifications: true, source: { name: 'iCloud' } }),
    ).toEqual({ id: 'c1', title: 'Work', source: 'iCloud', color: '#f00', allowsModifications: true });
  });

  it('handles a string source and a missing title', () => {
    expect(normalizeCalendar({ id: 'c2', source: 'Local' })).toMatchObject({
      title: 'Calendar',
      source: 'Local',
      allowsModifications: false,
    });
  });

  it('returns null without an id', () => {
    expect(normalizeCalendar({ title: 'x' })).toBeNull();
  });
});

describe('localDayRange', () => {
  it('is [today 00:00, tomorrow 00:00) in local time', () => {
    const { start, end } = localDayRange(NOW);
    expect(start.getHours()).toBe(0);
    expect(start.getDate()).toBe(6);
    expect(end.getDate()).toBe(7);
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('upcomingRange', () => {
  it('is [now, now + 7 days) by default', () => {
    const { start, end } = upcomingRange(NOW);
    expect(start.getTime()).toBe(NOW.getTime());
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('respects a custom day count', () => {
    const { start, end } = upcomingRange(NOW, 3);
    expect(end.getTime() - start.getTime()).toBe(3 * 24 * 60 * 60 * 1000);
  });
});

describe('sortByStart', () => {
  it('orders chronologically by start, then by end', () => {
    const a = normalized({ id: 'a', startDate: new Date(2026, 8, 6, 9).toISOString(), endDate: new Date(2026, 8, 6, 11).toISOString() });
    const b = normalized({ id: 'b', startDate: new Date(2026, 8, 6, 9).toISOString(), endDate: new Date(2026, 8, 6, 10).toISOString() });
    const c = normalized({ id: 'c', startDate: new Date(2026, 8, 6, 8).toISOString(), endDate: new Date(2026, 8, 6, 8, 30).toISOString() });
    expect(sortByStart([a, b, c]).map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('filterTodayEvents', () => {
  it('keeps events overlapping today and drops ones that already ended', () => {
    const earlierToday = normalized({ id: 'early', startDate: new Date(2026, 8, 6, 8).toISOString(), endDate: new Date(2026, 8, 6, 9).toISOString() });
    const inProgress = normalized({ id: 'now', startDate: new Date(2026, 8, 6, 9, 30).toISOString(), endDate: new Date(2026, 8, 6, 10, 30).toISOString() });
    const laterToday = normalized({ id: 'later', startDate: new Date(2026, 8, 6, 15).toISOString(), endDate: new Date(2026, 8, 6, 16).toISOString() });
    const yesterday = normalized({ id: 'yst', startDate: new Date(2026, 8, 5, 9).toISOString(), endDate: new Date(2026, 8, 5, 10).toISOString() });
    const tomorrow = normalized({ id: 'tmw', startDate: new Date(2026, 8, 7, 9).toISOString(), endDate: new Date(2026, 8, 7, 10).toISOString() });

    const result = filterTodayEvents([tomorrow, laterToday, yesterday, inProgress, earlierToday], NOW);
    expect(result.map((e) => e.id)).toEqual(['early', 'now', 'later']);
  });

  it('keeps an event that started yesterday and runs into today (spans midnight)', () => {
    const overnight = normalized({
      id: 'overnight',
      startDate: new Date(2026, 8, 5, 23, 0).toISOString(),
      endDate: new Date(2026, 8, 6, 1, 0).toISOString(),
    });
    expect(filterTodayEvents([overnight], NOW).map((e) => e.id)).toEqual(['overnight']);
  });

  it('keeps an all-day event for today', () => {
    const allDay = normalized({
      id: 'allday',
      isAllDay: true,
      startDate: new Date(2026, 8, 6, 0, 0).toISOString(),
      endDate: new Date(2026, 8, 7, 0, 0).toISOString(),
    });
    expect(filterTodayEvents([allDay], NOW).map((e) => e.id)).toEqual(['allday']);
  });

  it('keeps an event that starts late today and ends tomorrow', () => {
    const overnight = normalized({
      id: 'lateStart',
      startDate: new Date(2026, 8, 6, 23, 30).toISOString(),
      endDate: new Date(2026, 8, 7, 1, 0).toISOString(),
    });
    expect(filterTodayEvents([overnight], NOW).map((e) => e.id)).toEqual(['lateStart']);
  });
});

describe('filterUpcomingEvents', () => {
  it('keeps future events within the window, sorted', () => {
    const soon = normalized({ id: 'soon', startDate: new Date(2026, 8, 7, 9).toISOString(), endDate: new Date(2026, 8, 7, 10).toISOString() });
    const later = normalized({ id: 'later', startDate: new Date(2026, 8, 11, 9).toISOString(), endDate: new Date(2026, 8, 11, 10).toISOString() });
    const past = normalized({ id: 'past', startDate: new Date(2026, 8, 6, 8).toISOString(), endDate: new Date(2026, 8, 6, 9).toISOString() });
    const tooFar = normalized({ id: 'far', startDate: new Date(2026, 8, 20, 9).toISOString(), endDate: new Date(2026, 8, 20, 10).toISOString() });

    expect(filterUpcomingEvents([later, tooFar, past, soon], NOW).map((e) => e.id)).toEqual(['soon', 'later']);
  });
});

describe('toDomainEvent', () => {
  it('bridges to the domain CalendarEvent shape, namespacing the id and carrying isAllDay', () => {
    const domain = toDomainEvent(
      normalized({ id: 'x', title: 'Lecture', notes: 'ch. 3', location: 'LT19', isAllDay: false }),
    );
    expect(domain).toMatchObject({
      id: 'cal:x',
      title: 'Lecture',
      description: 'ch. 3',
      location: 'LT19',
      category: 'other',
      source: 'device_calendar',
      isAllDay: false,
    });
    expect(domain.startTime).toBe(normalized().startDate);
  });
});
