/**
 * Wires the active data sources into the pure `buildTodaySnapshot`. Composes the
 * existing events/tasks hooks — no direct service access here, respecting
 * `screen -> feature hook -> service`.
 *
 * Events come from `event-source` (the local demo source for now; a device
 * calendar source slots in there later without touching the Today UI). The
 * Today screen stays a single-hook consumer: it also gets the merged
 * `upcomingEvents` list for the UPCOMING section.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useActiveTasks } from '@/features/tasks/use-tasks';
import { useDayEvents, useUpcomingEvents } from '@/features/events/use-events';
import { buildTodaySnapshot } from '@/lib/todaySnapshot';
import { toLocalDateKey } from '@/lib/time';
import type { CalendarEvent, TodaySnapshot } from '@/types/models';

const ROLLOVER_CHECK_MS = 60_000;
/** How far the UPCOMING section looks ahead (days beyond today). */
const UPCOMING_DAYS = 4;

export interface UseTodaySnapshotResult {
  snapshot: TodaySnapshot;
  /** Today's full event list (past + current + future), for the timeline. */
  events: CalendarEvent[];
  /** Events over the next few days (includes today — the screen filters it out). */
  upcomingEvents: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTodaySnapshot(): UseTodaySnapshotResult {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));
  const dayEvents = useDayEvents(dateKey);
  const upcoming = useUpcomingEvents(UPCOMING_DAYS);
  const activeTasks = useActiveTasks();

  const snapshot = useMemo(
    () => buildTodaySnapshot(dayEvents.events, activeTasks.tasks, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dateKey` (not `new Date()`) is the real "has today changed" signal
    [dayEvents.events, activeTasks.tasks, dateKey],
  );

  // `dayEvents.refetch` / `upcoming.refetch` / `activeTasks.refetch` are all
  // stable (real useCallbacks), so this composed refetch stays stable too —
  // required so the memoized useFocusEffect callback doesn't refire on every
  // unrelated re-render (e.g. a loading-state flip).
  const refetch = useCallback(() => {
    setDateKey(toLocalDateKey(new Date()));
    dayEvents.refetch();
    upcoming.refetch();
    activeTasks.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [dayEvents.refetch, upcoming.refetch, activeTasks.refetch]);

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
    events: dayEvents.events,
    upcomingEvents: upcoming.events,
    loading: dayEvents.loading || activeTasks.loading,
    error: dayEvents.error ?? activeTasks.error,
    refetch,
  };
}
