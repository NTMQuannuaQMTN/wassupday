/**
 * The active event data source for the app.
 *
 * Currently the LOCAL DEMO source — realistic mock data with in-memory CRUD, so
 * the prototype runs fully offline in Expo Go. To use the real Supabase
 * backend instead, change the CRUD re-export below from
 * `@/services/demo/demo-events` to `@/services/events`. A device-calendar
 * source slots in the same way — the Today / Calendar UI depends only on this
 * module, never on a specific backend.
 */

// -- swap this line for a different backend --
export {
  createEvent,
  deleteEvent,
  getEvent,
  listEventsInRange,
  updateEvent,
} from '@/services/demo/demo-events';

export { validateEventInput } from '@/services/shared';
export type { EventInput, ServiceResult } from '@/services/shared';
