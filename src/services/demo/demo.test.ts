/**
 * The demo data source must produce a coherent Today: something happening now,
 * something next, a conflict, an overdue task, a completed task — so the demo
 * always looks alive whatever time it's run.
 */

import { createEvent, deleteEvent, listEventsInRange, updateEvent } from '@/services/demo/demo-events';
import { buildDemoEvents, buildDemoTasks } from '@/services/demo/demo-seed';
import { resetDemoStore } from '@/services/demo/demo-store';
import { createTask, listActiveTasks, listCompletedTasks, setTaskStatus } from '@/services/demo/demo-tasks';
import { detectConflicts } from '@/lib/conflicts';
import { isTaskOverdue } from '@/lib/taskBuckets';
import { buildTodaySnapshot } from '@/lib/todaySnapshot';

const NOW = new Date(2026, 8, 10, 13, 30); // Thu 2026-09-10, 13:30 local

beforeEach(() => resetDemoStore());

describe('buildDemoEvents', () => {
  it('has an event happening now and an event still to come', () => {
    const snap = buildTodaySnapshot(buildDemoEvents(NOW), [], NOW);
    expect(snap.currentEvent).not.toBeNull();
    expect(snap.nextEvent).not.toBeNull();
  });

  it('contains a deliberate overlap so the CONFLICTS section demos', () => {
    const conflicts = detectConflicts(buildDemoEvents(NOW).filter((e) => !e.isAllDay));
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('has events on later days for the UPCOMING section', () => {
    const events = buildDemoEvents(NOW);
    const laterDays = new Set(events.map((e) => new Date(e.startTime).getDate()));
    expect(laterDays.size).toBeGreaterThan(1);
  });
});

describe('buildDemoTasks', () => {
  it('produces an overdue task, a due-today task, and a completed one', () => {
    const tasks = buildDemoTasks(NOW);
    expect(tasks.some((t) => isTaskOverdue(t, NOW))).toBe(true);
    expect(tasks.some((t) => t.status === 'completed')).toBe(true);
    expect(tasks.some((t) => t.priority === 'high' && t.status === 'todo')).toBe(true);
  });

  it('feeds a populated Today snapshot', () => {
    const snap = buildTodaySnapshot(buildDemoEvents(NOW), buildDemoTasks(NOW), NOW);
    expect(snap.overdueTasks.length).toBeGreaterThan(0);
    expect(snap.priorityTasks.length).toBeGreaterThan(0);
  });
});

describe('demo event CRUD', () => {
  it('creates, lists, updates and deletes in memory', async () => {
    const created = await createEvent({
      title: 'Coffee with Sam',
      startTime: new Date(2026, 8, 10, 16).toISOString(),
      endTime: new Date(2026, 8, 10, 17).toISOString(),
      category: 'social',
    });
    expect(created.data?.id).toBeTruthy();
    const id = created.data!.id;

    const listed = await listEventsInRange(
      new Date(2026, 8, 10, 0).toISOString(),
      new Date(2026, 8, 11, 0).toISOString(),
    );
    expect(listed.data?.some((e) => e.id === id)).toBe(true);

    await updateEvent(id, { title: 'Coffee with Samir' });
    const afterUpdate = await listEventsInRange(
      new Date(2026, 8, 10, 0).toISOString(),
      new Date(2026, 8, 11, 0).toISOString(),
    );
    expect(afterUpdate.data?.find((e) => e.id === id)?.title).toBe('Coffee with Samir');

    await deleteEvent(id);
    const afterDelete = await listEventsInRange(
      new Date(2026, 8, 10, 0).toISOString(),
      new Date(2026, 8, 11, 0).toISOString(),
    );
    expect(afterDelete.data?.some((e) => e.id === id)).toBe(false);
  });

  it('rejects an invalid event', async () => {
    const res = await createEvent({ title: '', startTime: 'x', endTime: 'y' });
    expect(res.error).toBeTruthy();
  });
});

describe('demo task CRUD', () => {
  it('toggles completion between the active and completed lists', async () => {
    const created = await createTask({ title: 'Water the plants', priority: 'low' });
    const id = created.data!.id;

    let active = await listActiveTasks();
    expect(active.data?.some((t) => t.id === id)).toBe(true);

    await setTaskStatus(id, 'completed');
    active = await listActiveTasks();
    const completed = await listCompletedTasks();
    expect(active.data?.some((t) => t.id === id)).toBe(false);
    expect(completed.data?.some((t) => t.id === id)).toBe(true);
  });
});
