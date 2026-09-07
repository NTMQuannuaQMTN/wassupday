/**
 * Builds the Today dashboard's data in one pure function. No React, no
 * Supabase, no internal clock — `now` is a parameter, so the exact same
 * function is reusable by a future widget (see PROGRESS.md) and is fully
 * unit-testable without a fake clock.
 *
 * Does its own day-boundary filtering from `now` (callers may pass a wider
 * window of events/tasks than just "today") — this is what makes the date
 * rollover behavior testable: the same fixtures, evaluated at two different
 * `now` values, produce two different (correct) snapshots.
 */

import { detectConflicts } from '@/lib/conflicts';
import { compareByPriority, isTaskOverdue } from '@/lib/taskBuckets';
import { endOfLocalDay, startOfLocalDay, toLocalDateKey } from '@/lib/time';
import type { CalendarEvent, Task, TodaySnapshot } from '@/types/models';

/** Keep the dashboard glanceable — the full list lives on the Calendar/Tasks tabs. */
const UPCOMING_CAP = 5;
const TASK_CAP = 5;

function isOnLocalDay(event: CalendarEvent, dayStart: Date, dayEnd: Date): boolean {
  // Half-open overlap, consistent with services/events.ts's listEventsInRange.
  return new Date(event.startTime) < dayEnd && new Date(event.endTime) > dayStart;
}

export function buildTodaySnapshot(
  events: CalendarEvent[],
  tasks: Task[],
  now: Date,
): TodaySnapshot {
  const dayStart = startOfLocalDay(now);
  const dayEnd = endOfLocalDay(now);

  const todaysEvents = events
    .filter((e) => isOnLocalDay(e, dayStart, dayEnd))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // NEXT / current / conflicts consider timed events only — an all-day event
  // isn't "happening now" and doesn't clash with your 10:00 meeting. It still
  // shows in the timeline (the caller renders the full list).
  const timedEvents = todaysEvents.filter((e) => !e.isAllDay);

  const nowMs = now.getTime();
  const currentEvent =
    timedEvents.find(
      (e) => new Date(e.startTime).getTime() <= nowMs && new Date(e.endTime).getTime() > nowMs,
    ) ?? null;

  const future = timedEvents.filter((e) => new Date(e.startTime).getTime() > nowMs);
  const nextEvent = future[0] ?? null;
  const upcomingEvents = future.slice(1, 1 + UPCOMING_CAP);

  const activeTasks = tasks.filter((t) => t.status === 'todo');

  const overdueTasks = activeTasks
    .filter((t) => isTaskOverdue(t, now))
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, TASK_CAP);
  const overdueIds = new Set(overdueTasks.map((t) => t.id));

  const priorityTasks = activeTasks
    .filter((t) => !overdueIds.has(t.id))
    .filter((t) => t.priority === 'high' || (t.dueDate !== null && new Date(t.dueDate) < dayEnd))
    .sort(compareByPriority)
    .slice(0, TASK_CAP);

  return {
    date: toLocalDateKey(now),
    currentEvent,
    nextEvent,
    upcomingEvents,
    priorityTasks,
    overdueTasks,
    conflicts: detectConflicts(timedEvents),
    updatedAt: now.toISOString(),
  };
}
