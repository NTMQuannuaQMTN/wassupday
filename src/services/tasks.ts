/**
 * Tasks data access. Wraps supabase-js (parameterized / PostgREST) and maps
 * between DB rows (`snake_case`, `src/types/database.ts`) and domain models
 * (`camelCase`, `src/types/models.ts`). No UI or React here.
 *
 * `user_id` is never sent from the client — the column defaults to `auth.uid()`
 * and RLS re-checks it. Callers cannot create or read another user's tasks.
 *
 * Date-relative bucketing (today/upcoming/overdue/priority) is deliberately
 * NOT done here — that's `now`-dependent business logic and belongs in the
 * pure, unit-tested `lib/taskBuckets.ts`. This service only answers the cheap,
 * DB-native question of status: todo vs completed.
 */

import { supabase } from '@/lib/supabase';
import type { TaskRow } from '@/types/database';
import type { Task, TaskPriority, TaskStatus } from '@/types/models';

export type ServiceResult<T> = { data: T; error: null } | { data: null; error: string };

export interface TaskInput {
  title: string;
  description?: string | null;
  /** ISO 8601, or null for no due date. */
  dueDate?: string | null;
  priority?: TaskPriority;
  /** Minutes, 1–1440, or null. */
  estimatedDuration?: number | null;
}

const GENERIC = 'Something went wrong. Please try again.';

const TASK_COLUMNS =
  'id,user_id,title,description,due_date,priority,estimated_duration,status,source,created_at,updated_at';

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    priority: row.priority,
    estimatedDuration: row.estimated_duration,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRowFields(input: Partial<TaskInput>) {
  const fields: Partial<
    Omit<TaskRow, 'id' | 'user_id' | 'status' | 'source' | 'created_at' | 'updated_at'>
  > = {};
  if (input.title !== undefined) fields.title = input.title.trim();
  if (input.description !== undefined) {
    fields.description = input.description?.trim() ? input.description.trim() : null;
  }
  if (input.dueDate !== undefined) fields.due_date = input.dueDate;
  if (input.priority !== undefined) fields.priority = input.priority;
  if (input.estimatedDuration !== undefined) fields.estimated_duration = input.estimatedDuration;
  return fields;
}

function fail(context: string, error: unknown): { data: null; error: string } {
  if (__DEV__) console.warn(`[tasks] ${context}:`, error);
  return { data: null, error: GENERIC };
}

/** Not-yet-completed tasks. Ordered by due date (soonest first, no-due-date last). */
export async function listActiveTasks(): Promise<ServiceResult<Task[]>> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('status', 'todo')
      .order('due_date', { ascending: true, nullsFirst: false });
    if (error) return fail('listActiveTasks', error);
    return { data: (data as TaskRow[]).map(rowToTask), error: null };
  } catch (err) {
    return fail('listActiveTasks', err);
  }
}

/** Completed tasks, most recently completed first. */
export async function listCompletedTasks(limit = 30): Promise<ServiceResult<Task[]>> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) return fail('listCompletedTasks', error);
    return { data: (data as TaskRow[]).map(rowToTask), error: null };
  } catch (err) {
    return fail('listCompletedTasks', err);
  }
}

export async function getTask(id: string): Promise<ServiceResult<Task | null>> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select(TASK_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) return fail('getTask', error);
    return { data: data ? rowToTask(data as TaskRow) : null, error: null };
  } catch (err) {
    return fail('getTask', err);
  }
}

export async function createTask(input: TaskInput): Promise<ServiceResult<Task>> {
  const validation = validateTaskInput(input);
  if (validation) return { data: null, error: validation };
  try {
    // `user_id`, `status` and `source` are intentionally omitted — DB defaults
    // (auth.uid() / 'todo' / 'manual') apply, and RLS re-checks user_id.
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        due_date: input.dueDate ?? null,
        priority: input.priority ?? 'medium',
        estimated_duration: input.estimatedDuration ?? null,
      })
      .select(TASK_COLUMNS)
      .single();
    if (error) return fail('createTask', error);
    return { data: rowToTask(data as TaskRow), error: null };
  } catch (err) {
    return fail('createTask', err);
  }
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInput>,
): Promise<ServiceResult<Task>> {
  const validation = validateTaskInput(patch, { partial: true });
  if (validation) return { data: null, error: validation };
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update(toRowFields(patch))
      .eq('id', id)
      .select(TASK_COLUMNS)
      .single();
    if (error) return fail('updateTask', error);
    return { data: rowToTask(data as TaskRow), error: null };
  } catch (err) {
    return fail('updateTask', err);
  }
}

export async function deleteTask(id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (error) return fail('deleteTask', error);
    return { data: { id }, error: null };
  } catch (err) {
    return fail('deleteTask', err);
  }
}

/**
 * Quick-complete / un-complete. A narrow, dedicated path (payload is exactly
 * `{ status }`) so toggling a checkbox can never smuggle other field edits.
 */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<ServiceResult<Task>> {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', id)
      .select(TASK_COLUMNS)
      .single();
    if (error) return fail('setTaskStatus', error);
    return { data: rowToTask(data as TaskRow), error: null };
  } catch (err) {
    return fail('setTaskStatus', err);
  }
}

/** Returns an error string, or null when valid. Mirrors the DB CHECK constraints. */
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
