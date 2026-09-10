/**
 * Types and pure validation shared by every data source (Supabase, demo, and
 * later the device calendar). No I/O, no `@/lib/supabase` — so it's safe to
 * import from anywhere, including tests, without a native-module mock.
 *
 * `validate*Input` mirror the database CHECK constraints exactly, so the same
 * rules apply whether a record ends up in Postgres or the in-memory demo store.
 */

import type { EventCategory, TaskPriority } from '@/types/models';

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export interface EventInput {
  title: string;
  description?: string | null;
  /** ISO 8601, timezone-aware. */
  startTime: string;
  endTime: string;
  location?: string | null;
  category?: EventCategory;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  /** ISO 8601, or null for no due date. */
  dueDate?: string | null;
  priority?: TaskPriority;
  /** Minutes, 1–1440, or null. */
  estimatedDuration?: number | null;
}

/** Returns an error string, or null when valid. */
export function validateEventInput(
  input: Partial<EventInput>,
  opts: { partial?: boolean } = {},
): string | null {
  const requireAll = !opts.partial;

  if (input.title !== undefined || requireAll) {
    const title = input.title?.trim() ?? '';
    if (title.length < 1 || title.length > 200) return 'Give the event a title.';
  }
  if (input.description != null && input.description.length > 2000) {
    return 'That description is too long.';
  }
  if (input.location != null && input.location.length > 200) {
    return 'That location is too long.';
  }
  if (input.startTime !== undefined || input.endTime !== undefined || requireAll) {
    if (!input.startTime || !input.endTime) return 'Set a start and end time.';
    const start = Date.parse(input.startTime);
    const end = Date.parse(input.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) return 'Set a valid start and end time.';
    if (end < start) return 'The event ends before it starts.';
  }
  return null;
}

/** Returns an error string, or null when valid. */
export function validateTaskInput(
  input: Partial<TaskInput>,
  opts: { partial?: boolean } = {},
): string | null {
  const requireAll = !opts.partial;

  if (input.title !== undefined || requireAll) {
    const title = input.title?.trim() ?? '';
    if (title.length < 1 || title.length > 200) return 'Give the task a title.';
  }
  if (input.description != null && input.description.length > 2000) {
    return 'That description is too long.';
  }
  if (input.dueDate != null && Number.isNaN(Date.parse(input.dueDate))) {
    return 'Set a valid due date.';
  }
  if (
    input.estimatedDuration != null &&
    (!Number.isInteger(input.estimatedDuration) ||
      input.estimatedDuration <= 0 ||
      input.estimatedDuration > 1440)
  ) {
    return 'Estimated duration should be between 1 and 1440 minutes.';
  }
  return null;
}
