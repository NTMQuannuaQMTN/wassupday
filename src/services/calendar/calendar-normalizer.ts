/**
 * Pure transforms between raw `expo-calendar` data and WassupDay's normalized
 * model. No `expo-calendar` import here, no I/O, no `new Date()` without a
 * parameter — everything is unit-testable directly (calendar-normalizer.test.ts).
 */

import type { CalendarEvent } from '@/types/models';
import type { DeviceCalendar, DeviceCalendarEvent } from '@/services/calendar/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The subset of a raw Expo calendar event this app reads. Loosely typed on purpose. */
export interface RawExpoEvent {
  id?: string;
  instanceId?: string;
  calendarId?: string;
  title?: string | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
}

export interface RawExpoCalendar {
  id?: string;
  title?: string | null;
  color?: string | null;
  allowsModifications?: boolean;
  source?: { name?: string | null; title?: string | null } | string | null;
}

function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function cleanString(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Raw Expo event -> normalized model. Returns `null` for events that can't be
 * placed on a timeline (missing/invalid dates). Missing title/location/notes
 * fall back safely; a blank title becomes "Untitled event".
 */
export function normalizeEvent(raw: RawExpoEvent): DeviceCalendarEvent | null {
  const startDate = toIso(raw.startDate);
  let endDate = toIso(raw.endDate);
  if (!startDate) return null;
  // Missing/invalid end, or end before start -> treat as a zero-length point.
  if (!endDate || new Date(endDate) < new Date(startDate)) endDate = startDate;

  const id = raw.id ?? raw.instanceId;
  if (!id) return null;

  return {
    id,
    externalId: raw.id ?? id,
    calendarId: raw.calendarId ?? 'unknown',
    title: cleanString(raw.title) ?? 'Untitled event',
    startDate,
    endDate,
    location: cleanString(raw.location),
    notes: cleanString(raw.notes),
    isAllDay: raw.allDay === true,
    source: 'device_calendar',
  };
}

export function normalizeCalendar(raw: RawExpoCalendar): DeviceCalendar | null {
  if (!raw.id) return null;
  const sourceName =
    typeof raw.source === 'string' ? raw.source : (raw.source?.name ?? raw.source?.title ?? null);
  return {
    id: raw.id,
    title: cleanString(raw.title) ?? 'Calendar',
    source: cleanString(sourceName),
    color: cleanString(raw.color),
    allowsModifications: raw.allowsModifications ?? false,
  };
}

/** [today 00:00 local, tomorrow 00:00 local) — the user's local calendar day. */
export function localDayRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + DAY_MS);
  return { start, end };
}

/** [now, now + `days`) — the upcoming window. */
export function upcomingRange(now: Date, days = 7): { start: Date; end: Date } {
  return { start: new Date(now), end: new Date(now.getTime() + Math.max(1, days) * DAY_MS) };
}

/** Chronological by start time, then by end time (a stable tiebreak). */
export function sortByStart<T extends { startDate: string; endDate: string }>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const byStart = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    return byStart !== 0 ? byStart : new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });
}

/**
 * Events that overlap the local day of `now`: they end after the day starts and
 * start before the day ends. Correctly keeps an event that began yesterday and
 * runs into today (spans midnight), and drops anything that ended before today.
 * Result is sorted chronologically.
 */
export function filterTodayEvents(
  events: DeviceCalendarEvent[],
  now: Date,
): DeviceCalendarEvent[] {
  const { start, end } = localDayRange(now);
  return sortByStart(
    events.filter((e) => new Date(e.endDate) > start && new Date(e.startDate) < end),
  );
}

/** Future events within [now, now + days), sorted chronologically. */
export function filterUpcomingEvents(
  events: DeviceCalendarEvent[],
  now: Date,
  days = 7,
): DeviceCalendarEvent[] {
  const { start, end } = upcomingRange(now, days);
  return sortByStart(
    events.filter((e) => new Date(e.startDate) >= start && new Date(e.startDate) < end),
  );
}

/** Bridge to the app's domain model so the Today dashboard can treat calendar + in-app events uniformly. */
export function toDomainEvent(event: DeviceCalendarEvent): CalendarEvent {
  return {
    id: `cal:${event.id}`,
    userId: '',
    title: event.title,
    description: event.notes,
    startTime: event.startDate,
    endTime: event.endDate,
    location: event.location,
    category: 'other',
    source: 'device_calendar',
    isAllDay: event.isAllDay,
    createdAt: event.startDate,
    updatedAt: event.startDate,
  };
}
