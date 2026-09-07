/**
 * WassupDay's internal, normalized device-calendar model. Raw `expo-calendar`
 * objects never leave this service — the rest of the app consumes only these
 * plain, serializable shapes.
 *
 * `source` is a discriminant so future event sources (`manual`, `ai_import`,
 * `google_sync`, …) can share list/render code. Only `device_calendar` is
 * implemented for now.
 */

export interface DeviceCalendarEvent {
  /** Stable per-occurrence id (Expo event id; for recurring events, the instance id). */
  id: string;
  /** The underlying calendar-provider event id (same as `id` unless the platform distinguishes instances). */
  externalId: string;
  /** Id of the device calendar this event belongs to — preserved so per-calendar filtering can be added later. */
  calendarId: string;

  title: string;

  /** ISO 8601. For all-day events, local midnight of the first day. */
  startDate: string;
  /** ISO 8601. Always >= startDate. For all-day events, local midnight after the last day. */
  endDate: string;

  location: string | null;
  notes: string | null;

  isAllDay: boolean;

  source: 'device_calendar';
}

export interface DeviceCalendar {
  id: string;
  title: string;
  /** Provider account name / source title, when the platform exposes it. */
  source: string | null;
  color: string | null;
  allowsModifications: boolean;
}

export type CalendarPermissionStatus = 'undetermined' | 'granted' | 'denied';

export interface CalendarPermissionState {
  status: CalendarPermissionStatus;
  /** False once the OS will no longer show the prompt — send the user to Settings. */
  canAskAgain: boolean;
}
