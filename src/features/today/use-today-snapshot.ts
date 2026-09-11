/**
 * Wires the active data sources into the pure `buildTodaySnapshot`. Composes the
 * existing events/tasks hooks plus the device-calendar hook — no direct service
 * or `expo-calendar` access here, respecting `screen -> feature hook -> service`.
 *
 * Events come from two sources, merged uniformly:
 *   - `event-source` (the local/manual source — the demo data for now; a
 *     Supabase-backed source slots in the same way later without touching
 *     this hook or the Today UI).
 *   - the device calendar (when connected), via `useDeviceCalendar` +
 *     `toDomainEvent`. Read-only — nothing here writes to the device calendar.
 * The Today screen stays a single-hook consumer: it also gets the merged
 * `upcomingEvents` list for the UPCOMING section and the raw `calendar` state
 * for the connect card / permission modal.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useDeviceCalendar } from '@/features/calendar/use-device-calendar';
import { useActiveTasks } from '@/features/tasks/use-tasks';
import { useDayEvents, useUpcomingEvents } from '@/features/events/use-events';
import { toDomainEvent } from '@/services/calendar';
import { buildTodaySnapshot } from '@/lib/todaySnapshot';
import { toLocalDateKey } from '@/lib/time';
import type { CalendarEvent, TodaySnapshot } from '@/types/models';

const ROLLOVER_CHECK_MS = 60_000;
/** How far the UPCOMING section looks ahead (days beyond today). */
const UPCOMING_DAYS = 4;

export interface UseTodaySnapshotResult {
  snapshot: TodaySnapshot;
  /** Today's full merged event list (past + current + future, all sources). */
  events: CalendarEvent[];
  /** Merged events over the next few days (includes today — the screen filters it out). */
  upcomingEvents: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** Device-calendar integration, forwarded for the connect card + permission modal. */
  calendar: ReturnType<typeof useDeviceCalendar>;
}

export function useTodaySnapshot(): UseTodaySnapshotResult {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));
  const dayEvents = useDayEvents(dateKey);
  const upcoming = useUpcomingEvents(UPCOMING_DAYS);
  const activeTasks = useActiveTasks();
  const calendar = useDeviceCalendar();

  const mergedDayEvents = useMemo<CalendarEvent[]>(
    () => [...dayEvents.events, ...calendar.todayEvents.map(toDomainEvent)],
    [dayEvents.events, calendar.todayEvents],
  );
  const mergedUpcomingEvents = useMemo<CalendarEvent[]>(
    () => [...upcoming.events, ...calendar.upcomingEvents.map(toDomainEvent)],
    [upcoming.events, calendar.upcomingEvents],
  );

  const snapshot = useMemo(
    () => buildTodaySnapshot(mergedDayEvents, activeTasks.tasks, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dateKey` (not `new Date()`) is the real "has today changed" signal
    [mergedDayEvents, activeTasks.tasks, dateKey],
  );

  // `dayEvents.refetch` / `upcoming.refetch` / `activeTasks.refetch` /
  // `calendar.refresh` are all stable (real useCallbacks), so this composed
  // refetch stays stable too — required so the memoized useFocusEffect
  // callback doesn't refire on every unrelated re-render (e.g. a loading-state
  // flip).
  const refetch = useCallback(() => {
    setDateKey(toLocalDateKey(new Date()));
    dayEvents.refetch();
    upcoming.refetch();
    activeTasks.refetch();
    calendar.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [dayEvents.refetch, upcoming.refetch, activeTasks.refetch, calendar.refresh]);

  // Covers "left the app overnight, reopened" immediately on return to the tab.
  useFocusEffect(refetch);

  // 60s backstop for the rare case the app is left open, foregrounded and idle
  // across midnight without regaining focus. Not a per-second ticker.
  useEffect(() => {
    const interval = setInterval(() => {
      const today = toLocalDateKey(new Date());
      setDateKey((prev) => (prev === today ? prev : today));
    }, ROLLOVER_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    snapshot,
    events: mergedDayEvents,
    upcomingEvents: mergedUpcomingEvents,
    loading: dayEvents.loading || activeTasks.loading || calendar.isLoading,
    error: dayEvents.error ?? activeTasks.error ?? calendar.error,
    refetch,
    calendar,
  };
}
