/**
 * Wires real Supabase data into the pure `buildTodaySnapshot`. Composes the
 * existing events/tasks hooks — no direct Supabase access here, respecting
 * `screen -> feature hook -> service -> supabase`.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useActiveTasks } from '@/features/tasks/use-tasks';
import { useDayEvents } from '@/features/events/use-events';
import { buildTodaySnapshot } from '@/lib/todaySnapshot';
import { toLocalDateKey } from '@/lib/time';
import type { CalendarEvent, TodaySnapshot } from '@/types/models';

const ROLLOVER_CHECK_MS = 60_000;

export interface UseTodaySnapshotResult {
  snapshot: TodaySnapshot;
  /** Today's full event list (past + current + future) — see note below. */
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTodaySnapshot(): UseTodaySnapshotResult {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));
  const dayEvents = useDayEvents(dateKey);
  const activeTasks = useActiveTasks();

  const snapshot = useMemo(
    () => buildTodaySnapshot(dayEvents.events, activeTasks.tasks, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dateKey` (not `new Date()`) is the real "has today changed" signal
    [dayEvents.events, activeTasks.tasks, dateKey],
  );

  // `dayEvents.refetch` / `activeTasks.refetch` are themselves stable (real
  // useCallbacks in use-events.ts/use-tasks.ts), so this composed refetch
  // stays stable too — required so the memoized useFocusEffect callback below
  // doesn't refire on every unrelated re-render (e.g. a loading-state flip).
  const refetch = useCallback(() => {
    setDateKey(toLocalDateKey(new Date()));
    dayEvents.refetch();
    activeTasks.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [dayEvents.refetch, activeTasks.refetch]);

  // Covers "left the app overnight, reopened" immediately on return to the tab.
  useFocusEffect(refetch);

  // Deliberate, documented compromise: a 60s poll is the backstop for the rare
  // case the app is left open, foregrounded, and idle exactly across midnight
  // without regaining focus. Not a per-second ticker — currentEvent/nextEvent
  // and relative-time text are only as fresh as the last
  // focus/refetch/rollover-check, which is acceptable for a calm planner, not
  // a stopwatch.
  useEffect(() => {
    const interval = setInterval(() => {
      const today = toLocalDateKey(new Date());
      setDateKey((prev) => (prev === today ? prev : today));
    }, ROLLOVER_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    snapshot,
    // `TodaySnapshot` has no "full day" field (by design — see lib/todaySnapshot.ts),
    // but the dashboard's timeline shows the whole day, not just what's ahead.
    // Forwarding the raw list already fetched here is a hook-level convenience,
    // not a widening of the shared, widget-reused snapshot type.
    events: dayEvents.events,
    loading: dayEvents.loading || activeTasks.loading,
    error: dayEvents.error ?? activeTasks.error,
    refetch,
  };
}
