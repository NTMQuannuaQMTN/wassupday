/**
 * Wires real data into the pure `buildTodaySnapshot`. Composes the existing
 * events/tasks hooks plus the device-calendar hook — no direct Supabase or
 * `expo-calendar` access here, respecting `screen -> feature hook -> service`.
 *
 * Device-calendar events (when connected) are merged with in-app events so the
 * NEXT / TODAY / CONFLICTS logic treats every source uniformly. The device
 * calendar's own `upcomingEvents` and permission state are re-exposed so the
 * Today screen stays a single-hook consumer.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useDeviceCalendar } from '@/features/calendar/use-device-calendar';
import { useActiveTasks } from '@/features/tasks/use-tasks';
import { useDayEvents } from '@/features/events/use-events';
import { toDomainEvent } from '@/services/calendar';
import { buildTodaySnapshot } from '@/lib/todaySnapshot';
import { toLocalDateKey } from '@/lib/time';
import type { CalendarEvent, TodaySnapshot } from '@/types/models';

const ROLLOVER_CHECK_MS = 60_000;

export interface UseTodaySnapshotResult {
  snapshot: TodaySnapshot;
  /** Today's full merged event list (past + current + future, all sources). */
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  /** Device-calendar integration, forwarded for the connect card + UPCOMING section. */
  calendar: ReturnType<typeof useDeviceCalendar>;
}

export function useTodaySnapshot(): UseTodaySnapshotResult {
  const [dateKey, setDateKey] = useState(() => toLocalDateKey(new Date()));
  const dayEvents = useDayEvents(dateKey);
  const activeTasks = useActiveTasks();
  const calendar = useDeviceCalendar();

  const mergedEvents = useMemo<CalendarEvent[]>(
    () => [...dayEvents.events, ...calendar.todayEvents.map(toDomainEvent)],
    [dayEvents.events, calendar.todayEvents],
  );

  const snapshot = useMemo(
    () => buildTodaySnapshot(mergedEvents, activeTasks.tasks, new Date()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `dateKey` (not `new Date()`) is the real "has today changed" signal
    [mergedEvents, activeTasks.tasks, dateKey],
  );

  // `dayEvents.refetch` / `activeTasks.refetch` / `calendar.refresh` are all
  // stable (real useCallbacks), so this composed refetch stays stable too —
  // required so the memoized useFocusEffect callback doesn't refire on every
  // unrelated re-render (e.g. a loading-state flip).
  const refetch = useCallback(() => {
    setDateKey(toLocalDateKey(new Date()));
    dayEvents.refetch();
    activeTasks.refetch();
    calendar.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [dayEvents.refetch, activeTasks.refetch, calendar.refresh]);

  // Covers "left the app overnight, reopened" immediately on return to the tab.
  useFocusEffect(refetch);

  // Deliberate, documented compromise: a 60s poll is the backstop for the rare
  // case the app is left open, foregrounded, and idle exactly across midnight
  // without regaining focus. Not a per-second ticker.
  useEffect(() => {
    const interval = setInterval(() => {
      const today = toLocalDateKey(new Date());
      setDateKey((prev) => (prev === today ? prev : today));
    }, ROLLOVER_CHECK_MS);
    return () => clearInterval(interval);
  }, []);

  return {
    snapshot,
    events: mergedEvents,
    loading: dayEvents.loading || activeTasks.loading || calendar.isLoading,
    error: dayEvents.error ?? activeTasks.error ?? calendar.error,
    refetch,
    calendar,
  };
}
