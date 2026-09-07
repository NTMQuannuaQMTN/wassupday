/**
 * Pure, deterministic schedule-conflict detection. No AI, no I/O, no clock —
 * takes the events to check as a parameter and returns every overlapping
 * pair. Reused by the Today snapshot (`lib/todaySnapshot.ts`) and the event
 * save flow (`features/events/event-form.tsx`).
 */

import type { CalendarEvent, ScheduleConflict } from '@/types/models';

/**
 * Every pair of events that overlaps. Two events conflict when
 * `a.start < b.end && a.end > b.start` — a strict overlap, so events that
 * merely touch edges (one ends exactly when the other starts) do NOT count,
 * matching the half-open-interval convention already used by
 * `services/events.ts`'s `listEventsInRange`.
 *
 * O(n log n): sorts by start time, then scans pairwise with an early break
 * once a later event starts at/after the current event's end — no earlier
 * event in a start-sorted list can overlap it either from that point on.
 */
export function detectConflicts(events: CalendarEvent[]): ScheduleConflict[] {
  // All-day events don't "clash" with timed events — exclude them.
  const sorted = events
    .filter((e) => !e.isAllDay)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aEnd = new Date(a.endTime).getTime();

    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      const bStart = new Date(b.startTime).getTime();
      if (bStart >= aEnd) break; // sorted by start -> nothing further can overlap `a`

      const bEnd = new Date(b.endTime).getTime();
      const aStart = new Date(a.startTime).getTime();
      if (aStart < bEnd && aEnd > bStart) {
        conflicts.push({
          a,
          b,
          overlapStart: new Date(Math.max(aStart, bStart)).toISOString(),
          overlapEnd: new Date(Math.min(aEnd, bEnd)).toISOString(),
        });
      }
    }
  }

  return conflicts;
}
