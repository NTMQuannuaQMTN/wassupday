/**
 * Lazy access to the `expo-calendar` native module.
 *
 * `expo-calendar` (and the `/legacy` submodule the main entry pulls in for its
 * enum re-exports) calls `requireNativeModule()` at import time — that THROWS
 * in Expo Go, where the native module isn't bundled. A static import anywhere
 * in the Today-screen dependency graph would crash the app on launch in Expo
 * Go, so it's `require`d on demand instead (a string-literal require, so Metro
 * still bundles it; it just isn't executed until first use).
 *
 * Callers must already have decided the calendar is usable (see
 * `useDeviceCalendar`'s Expo Go guard) before calling this.
 */

type CalendarModule = typeof import('expo-calendar');

let cached: CalendarModule | undefined;

export function nativeCalendar(): CalendarModule {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberate lazy load, see file header
  cached ??= require('expo-calendar') as CalendarModule;
  return cached;
}
