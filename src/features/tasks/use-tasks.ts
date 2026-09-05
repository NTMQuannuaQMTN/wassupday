/**
 * Task data hooks for screens.
 *
 * Mirrors `features/events/use-events.ts`: no external data-fetching library,
 * each hook fetches on mount and exposes `refetch`; a module-level pub/sub
 * (`notifyTasksChanged`) lets a mutation on one screen refresh lists on
 * others (including the Today dashboard).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { bucketTasksForList, type TaskListBuckets } from '@/lib/taskBuckets';
import { getTask, listActiveTasks, listCompletedTasks } from '@/services/tasks';
import type { Task } from '@/types/models';

const listeners = new Set<() => void>();

/** Call after any create/update/delete/status-change so open lists revalidate. */
export function notifyTasksChanged(): void {
  listeners.forEach((l) => l());
}

function useRevalidateOn(refetch: () => void) {
  useEffect(() => {
    listeners.add(refetch);
    return () => {
      listeners.delete(refetch);
    };
  }, [refetch]);
}

interface TasksState {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Not-yet-completed tasks (any due date, or none). */
export function useActiveTasks(): TasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await listActiveTasks();
    if (res.data) {
      setTasks(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- signals the fetch starting below
    setLoading(true);
    listActiveTasks().then((res) => {
      if (!active) return;
      if (res.data) {
        setTasks(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useRevalidateOn(refetch);

  return { tasks, loading, error, refetch };
}

/** Completed tasks, most recently completed first. */
export function useCompletedTasks(limit = 30): TasksState {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const res = await listCompletedTasks(limit);
    if (res.data) {
      setTasks(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [limit]);

  useEffect(() => {
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- signals the fetch starting below
    setLoading(true);
    listCompletedTasks(limit).then((res) => {
      if (!active) return;
      if (res.data) {
        setTasks(res.data);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [limit]);

  useRevalidateOn(refetch);

  return { tasks, loading, error, refetch };
}

export function useTask(id: string | undefined) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const res = await getTask(id);
    if (res.error !== null) {
      setError(res.error);
    } else {
      setTask(res.data);
      setError(null);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see useActiveTasks above
    setLoading(true);
    refetch();
  }, [refetch]);
  useRevalidateOn(refetch);

  return { task, loading, error, refetch };
}

/** Today / Upcoming / Completed sections for the Tasks tab. */
export function useTaskSections(): TaskListBuckets & {
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const active = useActiveTasks();
  const completed = useCompletedTasks();

  const buckets = useMemo(
    () => bucketTasksForList(active.tasks, completed.tasks, new Date()),
    [active.tasks, completed.tasks],
  );

  // `active.refetch` / `completed.refetch` are themselves stable (real
  // useCallbacks with fixed deps inside useActiveTasks/useCompletedTasks), so
  // depending on them directly (not the whole `active`/`completed` objects,
  // which ARE new every render) keeps this composed refetch stable too —
  // required so a memoized `useFocusEffect` callback built on top of it
  // doesn't refire on every unrelated re-render.
  const refetch = useCallback(() => {
    active.refetch();
    completed.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above
  }, [active.refetch, completed.refetch]);

  return {
    ...buckets,
    loading: active.loading || completed.loading,
    error: active.error ?? completed.error,
    refetch,
  };
}
