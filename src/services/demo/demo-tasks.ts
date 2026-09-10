/**
 * Demo task data source — the same surface as `services/tasks.ts`, backed by
 * the in-memory `demo-store`. Validation is shared with the real service.
 */

import { getDemoTasks, setDemoTasks } from '@/services/demo/demo-store';
import { validateTaskInput, type ServiceResult, type TaskInput } from '@/services/shared';
import type { Task, TaskStatus } from '@/types/models';

const ok = <T>(data: T): ServiceResult<T> => ({ data, error: null });

function genId(): string {
  return `demo-task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

const byDueDate = (a: Task, b: Task) => {
  if (a.dueDate === b.dueDate) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return Date.parse(a.dueDate) - Date.parse(b.dueDate);
};

export async function listActiveTasks(): Promise<ServiceResult<Task[]>> {
  return ok(getDemoTasks().filter((t) => t.status === 'todo').sort(byDueDate));
}

export async function listCompletedTasks(limit = 30): Promise<ServiceResult<Task[]>> {
  const list = getDemoTasks()
    .filter((t) => t.status === 'completed')
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, limit);
  return ok(list);
}

export async function getTask(id: string): Promise<ServiceResult<Task | null>> {
  return ok(getDemoTasks().find((t) => t.id === id) ?? null);
}

export async function createTask(input: TaskInput): Promise<ServiceResult<Task>> {
  const err = validateTaskInput(input);
  if (err) return { data: null, error: err };
  const nowIso = new Date().toISOString();
  const created: Task = {
    id: genId(),
    userId: 'demo',
    title: input.title.trim(),
    description: input.description?.trim() || null,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 'medium',
    estimatedDuration: input.estimatedDuration ?? null,
    status: 'todo',
    source: 'manual',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  setDemoTasks([...getDemoTasks(), created]);
  return ok(created);
}

export async function updateTask(
  id: string,
  patch: Partial<TaskInput>,
): Promise<ServiceResult<Task>> {
  const err = validateTaskInput(patch, { partial: true });
  if (err) return { data: null, error: err };
  const list = getDemoTasks();
  const existing = list.find((t) => t.id === id);
  if (!existing) return { data: null, error: 'Task not found.' };
  const updated: Task = {
    ...existing,
    ...(patch.title !== undefined && { title: patch.title.trim() }),
    ...(patch.description !== undefined && {
      description: patch.description?.trim() || null,
    }),
    ...(patch.dueDate !== undefined && { dueDate: patch.dueDate }),
    ...(patch.priority !== undefined && { priority: patch.priority }),
    ...(patch.estimatedDuration !== undefined && { estimatedDuration: patch.estimatedDuration }),
    updatedAt: new Date().toISOString(),
  };
  setDemoTasks(list.map((t) => (t.id === id ? updated : t)));
  return ok(updated);
}

export async function deleteTask(id: string): Promise<ServiceResult<{ id: string }>> {
  setDemoTasks(getDemoTasks().filter((t) => t.id !== id));
  return ok({ id });
}

export async function setTaskStatus(id: string, status: TaskStatus): Promise<ServiceResult<Task>> {
  const list = getDemoTasks();
  const existing = list.find((t) => t.id === id);
  if (!existing) return { data: null, error: 'Task not found.' };
  const updated: Task = { ...existing, status, updatedAt: new Date().toISOString() };
  setDemoTasks(list.map((t) => (t.id === id ? updated : t)));
  return ok(updated);
}
