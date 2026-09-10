/**
 * Owns device-calendar permission state and the today/upcoming event reads.
 *
 * Permission is never requested automatically — `connect()` must be called from
 * an explicit user action (the Connect Calendar button). Events refresh when
 * access is first granted, on screen focus, on pull-to-refresh, and when the
 * app returns to the foreground. Concurrent refreshes are race-guarded: only
 * the most recent run commits its results.
 *
 * `expo-calendar` is a native module that is NOT in Expo Go — when running
 * there, `unavailable` is `'expo-go'` and nothing native is ever called.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';

import {
  getPermissionState,
  getTodayEvents,
  getUpcomingEvents,
  openCalendarSettings,
  requestPermission,
  type CalendarPermissionStatus,
  type DeviceCalendarEvent,
} from '@/services/calendar';

const UPCOMING_DAYS = 7;
const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** Why the calendar can't be used at all (separate from a permission decision). */
export type CalendarUnavailableReason = 'expo-go';

export interface UseDeviceCalendarResult {
  /** True once the initial availability + permission check has resolved. */
  ready: boolean;
  /** Non-null when the device/runtime can't do calendar access regardless of permission. */
  unavailable: CalendarUnavailableReason | null;
  status: CalendarPermissionStatus;
  /** False once the OS won't prompt again — route the user to Settings. */
  canAskAgain: boolean;
  todayEvents: DeviceCalendarEvent[];
  upcomingEvents: DeviceCalendarEvent[];
  /** First load (no data yet). */
  isLoading: boolean;
  /** A refresh while data is already on screen. */
  isRefreshing: boolean;
  error: string | null;
  /** Prompt for permission, then load (call from a button press only). */
  connect: () => Promise<void>;
  /** Re-read events if access is granted. */
  refresh: () => void;
  /** Open the OS settings screen for this app. */
  openSettings: () => void;
}

export function useDeviceCalendar(): UseDeviceCalendarResult {
  // In Expo Go the answer is known synchronously — nothing native to await.
  const unavailable: CalendarUnavailableReason | null = IS_EXPO_GO ? 'expo-go' : null;
  const [ready, setReady] = useState(IS_EXPO_GO);
  const [status, setStatus] = useState<CalendarPermissionStatus>('undetermined');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [todayEvents, setTodayEvents] = useState<DeviceCalendarEvent[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<DeviceCalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    // Race guard: one read at a time. A concurrent request (focus + AppState +
    // pull-to-refresh firing together) is dropped — the running read's fresh
    // data satisfies it too.
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (hasLoadedRef.current) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const [today, upcoming] = await Promise.all([
        getTodayEvents(),
        getUpcomingEvents(new Date(), UPCOMING_DAYS),
      ]);
      setTodayEvents(today);
      setUpcomingEvents(upcoming);
      hasLoadedRef.current = true;
      setError(null);
    } catch (err) {
      if (__DEV__) console.warn('[useDeviceCalendar] load:', err);
      setError('Could not read your calendar.');
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // On mount: read the current permission WITHOUT prompting; load if already
  // granted. Skipped in Expo Go (native module absent).
  useEffect(() => {
    if (IS_EXPO_GO) return; // resolved synchronously in useState above
    let active = true;
    getPermissionState().then((state) => {
      if (!active) return;
      setStatus(state.status);
      setCanAskAgain(state.canAskAgain);
      setReady(true);
      if (state.status === 'granted') load();
    });
    return () => {
      active = false;
    };
  }, [load]);

  const connect = useCallback(async () => {
    if (unavailable) return;
    const state = await requestPermission();
    setStatus(state.status);
    setCanAskAgain(state.canAskAgain);
    if (state.status === 'granted') await load();
  }, [unavailable, load]);

  const refresh = useCallback(() => {
    if (!hasLoadedRef.current) return; // not granted / initial load hasn't run yet
    void load();
  }, [load]);

  // Refresh on tab focus (e.g. reopened after being away).
  useFocusEffect(
    useCallback(() => {
      if (status === 'granted') refresh();
    }, [status, refresh]),
  );

  // Refresh when the app returns to the foreground (user added an event in the
  // Calendar app and came back).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status === 'granted') refresh();
    });
    return () => sub.remove();
  }, [status, refresh]);

  return {
    ready,
    unavailable,
    status,
    canAskAgain,
    todayEvents,
    upcomingEvents,
    isLoading,
    isRefreshing,
    error,
    connect,
    refresh,
    openSettings: openCalendarSettings,
  };
}
