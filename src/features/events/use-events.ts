/**
 * Event data hooks for screens.
 *
 * No external data-fetching library: each hook fetches on mount and exposes
 * `refetch`. A tiny module-level pub/sub (`notifyEventsChanged`) lets a mutation
 * on one screen refresh lists on others, and screens also refetch on focus.
 */

import { useCallback, useEffect, useState } from 'react';

import { getEvent, listEventsInRange } from '@/services/events';
import { localDayRangeIso, toLocalDateKey } from '@/lib/time';
import type { CalendarEvent } from '@/types/models';

const listeners = new Set<() => void>();

/** Call after any create/update/delete so open lists revalidate. */
export function notifyEventsChanged(): void {
  listeners.forEach((l) => l());
}

function useRevalidateOn(refetch: () => void) {
  useEffect(() => {
    listeners.add(refetch);
    return () => {
      listeners.delete(refetch);
    };
  }, [refetch]);
}

interface RangeState {
  events: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useEventsInRange(fromISO: string, toISO: string): RangeState {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await listEventsInRange(fromISO, toISO);
    if (res.data) {
      setEvents(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [fromISO, toISO]);

  useEffect(() => {
    let active = true;
    // Signals the fetch that's about to start (below), not derived from props
    // or state — this is the effect synchronizing with an external system.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    listEventsInRange(fromISO, toISO).then((res) => {
      if (!active) return;
      if (res.data) {
        setEvents(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [fromISO, toISO]);

  useRevalidateOn(refetch);

  return { events, loading, error, refetch };
}

/** Events occurring on a given local day (default: today). */
export function useDayEvents(dateKey?: string): RangeState & { dateKey: string } {
  const key = dateKey ?? toLocalDateKey(new Date());
  const { fromISO, toISO } = localDayRangeIso(key);
  return { ...useEventsInRange(fromISO, toISO), dateKey: key };
}

/** Events from the start of today through the next `days` days. */
export function useUpcomingEvents(days = 7): RangeState {
  const key = toLocalDateKey(new Date());
  const { fromISO, toISO } = localDayRangeIso(key, days);
  return useEventsInRange(fromISO, toISO);
}

export function useEvent(id: string | undefined) {
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const res = await getEvent(id);
    if (res.error !== null) {
      setError(res.error);
    } else {
      setEvent(res.data);
      setError(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see useEventsInRange above
    setLoading(true);
    refetch();
  }, [refetch]);
  useRevalidateOn(refetch);

  return { event, loading, error, refetch };
}
