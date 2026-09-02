/**
 * Small, dependency-free time helpers.
 *
 * The app stores all instants as timezone-aware ISO 8601 strings (Postgres
 * `timestamptz`). "Today" is always evaluated against the *device's* local
 * calendar day. These helpers are pure so they can be unit tested directly
 * (see time.test.ts) and reused by the Today snapshot generator and widgets.
 */

const MS_PER_MINUTE = 60_000;

/** Local calendar date of an instant, as YYYY-MM-DD. */
export function toLocalDateKey(instant: Date | string): string {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** True when both instants fall on the same local calendar day. */
export function isSameLocalDay(a: Date | string, b: Date | string): boolean {
  return toLocalDateKey(a) === toLocalDateKey(b);
}

/** True when `instant` is on the same local day as `reference` (default: now). */
export function isToday(instant: Date | string, reference: Date = new Date()): boolean {
  return isSameLocalDay(instant, reference);
}

/**
 * Whole minutes from `from` until `to`. Negative when `to` is in the past.
 * Rounded towards zero so "in 42 minutes" never rounds up to something that has
 * not happened yet.
 */
export function minutesBetween(from: Date | string, to: Date | string): number {
  const fromMs = (typeof from === 'string' ? new Date(from) : from).getTime();
  const toMs = (typeof to === 'string' ? new Date(to) : to).getTime();
  return Math.trunc((toMs - fromMs) / MS_PER_MINUTE);
}

/** Start of the local day (00:00:00.000) for the given instant. */
export function startOfLocalDay(instant: Date | string): Date {
  const d = new Date(typeof instant === 'string' ? instant : instant.getTime());
  d.setHours(0, 0, 0, 0);
  return d;
}

/** End of the local day (23:59:59.999) for the given instant. */
export function endOfLocalDay(instant: Date | string): Date {
  const d = new Date(typeof instant === 'string' ? instant : instant.getTime());
  d.setHours(23, 59, 59, 999);
  return d;
}
