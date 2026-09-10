/**
 * Calendar permission checks/requests. The only place that touches
 * `expo-calendar`'s permission API (lazily — see `native.ts`).
 *
 * iOS 17+ has no "read-only" calendar permission tier — reading events at all
 * requires Full Access, so `requestPermission()` asks for full access (never
 * write-only). We still never call a write API.
 */

import type { PermissionResponse } from 'expo-calendar';
import { Linking, Platform } from 'react-native';

import { nativeCalendar } from '@/services/calendar/native';
import type { CalendarPermissionState } from '@/services/calendar/types';

function toState(response: PermissionResponse): CalendarPermissionState {
  const status =
    response.status === 'granted' ? 'granted' : response.status === 'denied' ? 'denied' : 'undetermined';
  return { status, canAskAgain: response.canAskAgain };
}

/** Current permission state without prompting the user. */
export async function getPermissionState(): Promise<CalendarPermissionState> {
  try {
    return toState(await nativeCalendar().getCalendarPermissions());
  } catch {
    return { status: 'undetermined', canAskAgain: true };
  }
}

/** Show the OS permission prompt (call only from an explicit user action). */
export async function requestPermission(): Promise<CalendarPermissionState> {
  try {
    return toState(await nativeCalendar().requestCalendarPermissions());
  } catch {
    return { status: 'denied', canAskAgain: false };
  }
}

/** Deep-link to the app's settings so the user can enable calendar access after denying. */
export async function openCalendarSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openURL('app-settings:');
  } else {
    await Linking.openSettings();
  }
}
