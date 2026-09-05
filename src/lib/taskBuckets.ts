/**
 * Pure, `now`-dependent task bucketing/ordering logic.
 *
 * Deliberately separate from `services/tasks.ts`: the DB only ever answers a
 * cheap status question (todo vs completed). Everything about "is this task
 * overdue / due today / important" is business logic that depends on the
 * current instant, so it lives here — no React, no Supabase, `now` taken as a
 * parameter — and is unit tested directly (taskBuckets.test.ts). Reused by
 * both the Tasks tab (`bucketTasksForList`) and the Today dashboard
 * (`lib/todaySnapshot.ts`, via `isTaskOverdue` / `compareByPriority`).
 */

import { startOfLocalDay } from '@/lib/time';
import type { Task } from '@/types/models';

const PRIORITY_RANK: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 };

/** A todo task whose due date has passed (strictly before today). Never true for a completed task. */
export function isTaskOverdue(task: Task, now: Date): boolean {
  if (task.status !== 'todo' || task.dueDate === null) return false;
  return new Date(task.dueDate) < startOfLocalDay(now);
}

/**
 * high > medium > low; ties broken by due date ascending (no-due-date last),
 * then title. Deterministic ordering for any list of tasks with the same status.
 */
export function compareByPriority(a: Task, b: Task): number {
  const byPriority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (byPriority !== 0) return byPriority;

  if (a.dueDate !== b.dueDate) {
    if (a.dueDate === null) return 1;
    if (b.dueDate === null) return -1;
    const byDueDate = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    if (byDueDate !== 0) return byDueDate;
  }
  return a.title.localeCompare(b.title);
}

export interface TaskListBuckets {
  today: Task[];
  upcoming: Task[];
  completed: Task[];
}

/**
 * Buckets for the Tasks tab's three sections. `active` = todo tasks (any due
 * date), `completed` = already-completed tasks (passed through as given —
 * the service already orders them most-recently-completed first).
 *
 * - today: overdue, due today, or no due date at all ("anytime" tasks default
 *   here so they stay visible rather than disappearing into a date-only bucket).
 *   Sorted: overdue first (oldest due date first), then due-today (by time),
 *   then no-due-date (by priority).
 * - upcoming: due strictly after today, sorted by due date then priority.
 */
export function bucketTasksForList(active: Task[], completed: Task[], now: Date): TaskListBuckets {
  const startOfToday = startOfLocalDay(now);
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const noDueDate: Task[] = [];
  const upcoming: Task[] = [];

  for (const task of active) {
    if (task.dueDate === null) {
      noDueDate.push(task);
      continue;
    }
    const due = new Date(task.dueDate);
    if (due < startOfToday) overdue.push(task);
    else if (due < endOfToday) dueToday.push(task);
    else upcoming.push(task);
  }

  overdue.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  dueToday.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  noDueDate.sort(compareByPriority);
  upcoming.sort((a, b) => {
    const byDueDate = new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime();
    return byDueDate !== 0 ? byDueDate : compareByPriority(a, b);
  });

  return {
    today: [...overdue, ...dueToday, ...noDueDate],
    upcoming,
    completed,
  };
}
