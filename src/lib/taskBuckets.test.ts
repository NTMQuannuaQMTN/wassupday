import { bucketTasksForList, compareByPriority, isTaskOverdue } from '@/lib/taskBuckets';
import type { Task } from '@/types/models';

const NOW = new Date(2026, 8, 4, 10, 0); // Fri 2026-09-04, 10:00 local

let seq = 0;
function makeTask(overrides: Partial<Task> = {}): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    userId: 'u1',
    title: `Task ${seq}`,
    description: null,
    dueDate: null,
    priority: 'medium',
    estimatedDuration: null,
    status: 'todo',
    source: 'manual',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  seq = 0;
});

describe('isTaskOverdue', () => {
  it('is true for a todo task due yesterday', () => {
    const task = makeTask({ dueDate: new Date(2026, 8, 3, 23, 0).toISOString() });
    expect(isTaskOverdue(task, NOW)).toBe(true);
  });

  it('is false for a todo task due later today', () => {
    const task = makeTask({ dueDate: new Date(2026, 8, 4, 23, 0).toISOString() });
    expect(isTaskOverdue(task, NOW)).toBe(false);
  });

  it('is false for a todo task due earlier today (still today, not overdue)', () => {
    const task = makeTask({ dueDate: new Date(2026, 8, 4, 0, 30).toISOString() });
    expect(isTaskOverdue(task, NOW)).toBe(false);
  });

  it('is false for a task due tomorrow', () => {
    const task = makeTask({ dueDate: new Date(2026, 8, 5, 0, 0).toISOString() });
    expect(isTaskOverdue(task, NOW)).toBe(false);
  });

  it('is false when there is no due date', () => {
    expect(isTaskOverdue(makeTask({ dueDate: null }), NOW)).toBe(false);
  });

  it('is false for a completed task even if the due date passed', () => {
    const task = makeTask({
      status: 'completed',
      dueDate: new Date(2026, 8, 1, 0, 0).toISOString(),
    });
    expect(isTaskOverdue(task, NOW)).toBe(false);
  });
});

describe('compareByPriority', () => {
  it('orders high > medium > low', () => {
    const low = makeTask({ priority: 'low' });
    const medium = makeTask({ priority: 'medium' });
    const high = makeTask({ priority: 'high' });
    const sorted = [low, high, medium].sort(compareByPriority);
    expect(sorted).toEqual([high, medium, low]);
  });

  it('ties break by due date ascending, no-due-date last', () => {
    const noDue = makeTask({ priority: 'high', dueDate: null });
    const dueLater = makeTask({ priority: 'high', dueDate: new Date(2026, 8, 10).toISOString() });
    const dueSooner = makeTask({ priority: 'high', dueDate: new Date(2026, 8, 5).toISOString() });
    const sorted = [noDue, dueLater, dueSooner].sort(compareByPriority);
    expect(sorted).toEqual([dueSooner, dueLater, noDue]);
  });

  it('final tie-break is title', () => {
    const b = makeTask({ priority: 'medium', title: 'Bravo' });
    const a = makeTask({ priority: 'medium', title: 'Alpha' });
    expect([b, a].sort(compareByPriority)).toEqual([a, b]);
  });
});

describe('bucketTasksForList', () => {
  it('puts overdue, due-today and no-due-date tasks into "today", in that sub-order', () => {
    const noDue = makeTask({ title: 'No due date' });
    const dueToday = makeTask({ title: 'Due today', dueDate: new Date(2026, 8, 4, 18, 0).toISOString() });
    const overdue = makeTask({ title: 'Overdue', dueDate: new Date(2026, 8, 2, 9, 0).toISOString() });

    const buckets = bucketTasksForList([noDue, dueToday, overdue], [], NOW);
    expect(buckets.today.map((t) => t.title)).toEqual(['Overdue', 'Due today', 'No due date']);
  });

  it('puts future-due tasks into "upcoming", excluded from "today"', () => {
    const future = makeTask({ dueDate: new Date(2026, 8, 6).toISOString() });
    const buckets = bucketTasksForList([future], [], NOW);
    expect(buckets.today).toEqual([]);
    expect(buckets.upcoming).toEqual([future]);
  });

  it('orders "upcoming" by due date then priority', () => {
    const later = makeTask({ title: 'Later', dueDate: new Date(2026, 8, 10).toISOString() });
    const soonerLow = makeTask({
      title: 'Sooner low',
      priority: 'low',
      dueDate: new Date(2026, 8, 6).toISOString(),
    });
    const soonerHigh = makeTask({
      title: 'Sooner high',
      priority: 'high',
      dueDate: new Date(2026, 8, 6).toISOString(),
    });
    const buckets = bucketTasksForList([later, soonerLow, soonerHigh], [], NOW);
    expect(buckets.upcoming.map((t) => t.title)).toEqual(['Sooner high', 'Sooner low', 'Later']);
  });

  it('multiple overdue tasks sort oldest-due-first', () => {
    const recent = makeTask({ title: 'Recent', dueDate: new Date(2026, 8, 3).toISOString() });
    const old = makeTask({ title: 'Old', dueDate: new Date(2026, 8, 1).toISOString() });
    const buckets = bucketTasksForList([recent, old], [], NOW);
    expect(buckets.today.map((t) => t.title)).toEqual(['Old', 'Recent']);
  });

  it('passes completed tasks through unchanged', () => {
    const completed = [makeTask({ status: 'completed' }), makeTask({ status: 'completed' })];
    const buckets = bucketTasksForList([], completed, NOW);
    expect(buckets.completed).toBe(completed);
  });

  it('handles empty input', () => {
    expect(bucketTasksForList([], [], NOW)).toEqual({ today: [], upcoming: [], completed: [] });
  });
});
