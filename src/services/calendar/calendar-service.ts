/**
 * Orchestrates `expo-calendar` reads and hands back only normalized models.
 * The only module (besides calendar-permissions) that imports `expo-calendar`.
 *
 * Read-only: nothing here creates, updates or deletes calendars or events.
 * Uses the SDK 57 object-oriented API (`getCalendars`, `listEvents`).
 */

import * as Calendar from 'expo-calendar';
import { isAvailableAsync } from 'expo-calendar/legacy';

import {
  filterTodayEvents,
  filterUpcomingEvents,
  localDayRange,
  normalizeCalendar,
  normalizeEvent,
  upcomingRange,
  type RawExpoCalendar,
  type RawExpoEvent,
} from '@/services/calendar/calendar-normalizer';
import type { DeviceCalendar, DeviceCalendarEvent } from '@/services/calendar/types';

function warn(context: string, error: unknown) {
  if (__DEV__) console.warn(`[calendar] ${context}:`, error);
}

/** Whether the device exposes a calendar API at all (very rarely false). */
export async function isCalendarAvailable(): Promise<boolean> {
  try {
    return await isAvailableAsync();
  } catch (err) {
    warn('isCalendarAvailable', err);
    return false;
  }
}

/** Event calendars the app can read (all of them — no selection UI yet). */
export async function getEventCalendars(): Promise<DeviceCalendar[]> {
  const raw = (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)) as unknown as RawExpoCalendar[];
  return raw.map(normalizeCalendar).filter((c): c is DeviceCalendar => c !== null);
}

async function readEvents(from: Date, to: Date): Promise<DeviceCalendarEvent[]> {
  const calendars = await getEventCalendars();
  if (calendars.length === 0) return [];
  const raw = (await Calendar.listEvents(
    calendars.map((c) => c.id),
    from,
    to,
  )) as unknown as RawExpoEvent[];
  return raw.map(normalizeEvent).filter((e): e is DeviceCalendarEvent => e !== null);
}

/**
 * Events on the user's local calendar day (`now` defaults to the real now).
 * Includes all-day events, in-progress events, and events spanning midnight;
 * excludes events that ended before today. Sorted chronologically.
 */
export async function getTodayEvents(now: Date = new Date()): Promise<DeviceCalendarEvent[]> {
  const { start, end } = localDayRange(now);
  // Widen the query one day back so an event that began yesterday and runs into
  // today is returned by the native layer; filterTodayEvents trims the rest.
  const events = await readEvents(new Date(start.getTime() - 24 * 60 * 60 * 1000), end);
  return filterTodayEvents(events, now);
}

/** Events starting within [now, now + `days`), sorted chronologically. */
export async function getUpcomingEvents(
  now: Date = new Date(),
  days = 7,
): Promise<DeviceCalendarEvent[]> {
  const { start, end } = upcomingRange(now, days);
  return filterUpcomingEvents(await readEvents(start, end), now, days);
}
