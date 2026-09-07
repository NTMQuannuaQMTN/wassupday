/** Device calendar integration — read-only. Public surface for the app. */

export type {
  CalendarPermissionState,
  CalendarPermissionStatus,
  DeviceCalendar,
  DeviceCalendarEvent,
} from '@/services/calendar/types';

export {
  getPermissionState,
  openCalendarSettings,
  requestPermission,
} from '@/services/calendar/calendar-permissions';

export {
  getEventCalendars,
  getTodayEvents,
  getUpcomingEvents,
  isCalendarAvailable,
} from '@/services/calendar/calendar-service';

export { toDomainEvent } from '@/services/calendar/calendar-normalizer';
