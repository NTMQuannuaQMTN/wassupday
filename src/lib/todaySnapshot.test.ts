import { buildTodaySnapshot } from '@/lib/todaySnapshot';
import type { CalendarEvent, Task, TaskPriority } from '@/types/models';

let seq = 0;

function makeEvent(
  title: string,
  start: Date,
  end: Date,
  opts: { isAllDay?: boolean } = {},
): CalendarEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    userId: 'u1',
    title,
    description: null,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    location: null,
    category: 'other',
    source: 'manual',
    isAllDay: opts.isAllDay,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function makeTask(
  title: string,
  opts: { dueDate?: Date | null; priority?: TaskPriority; status?: Task['status'] } = {},
): Task {
  seq += 1;
  return {
    id: `t${seq}`,
    userId: 'u1',
    title,
    description: null,
    dueDate: opts.dueDate ? opts.dueDate.toISOString() : null,
    priority: opts.priority ?? 'medium',
    estimatedDuration: null,
    status: opts.status ?? 'todo',
    source: 'manual',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  seq = 0;
});

const NOW = new Date(2026, 8, 4, 10, 0); // Fri 2026-09-04, 10:00 local

describe('buildTodaySnapshot', () => {
  it('returns an empty snapshot for no events/tasks', () => {
    const snapshot = buildTodaySnapshot([], [], NOW);
    expect(snapshot.date).toBe('2026-09-04');
    expect(snapshot.currentEvent).toBeNull();
    expect(snapshot.nextEvent).toBeNull();
    expect(snapshot.upcomingEvents).toEqual([]);
    expect(snapshot.priorityTasks).toEqual([]);
    expect(snapshot.overdueTasks).toEqual([]);
    expect(snapshot.conflicts).toEqual([]);
  });

  it('picks the event spanning `now` as currentEvent', () => {
    const current = makeEvent('Lecture', new Date(2026, 8, 4, 9, 0), new Date(2026, 8, 4, 11, 0));
    const snapshot = buildTodaySnapshot([current], [], NOW);
    expect(snapshot.currentEvent?.title).toBe('Lecture');
    expect(snapshot.nextEvent).toBeNull();
  });

  it('picks the soonest future event as nextEvent, and excludes it from upcomingEvents', () => {
    const soon = makeEvent('Team Meeting', new Date(2026, 8, 4, 11, 0), new Date(2026, 8, 4, 12, 0));
    const later = makeEvent('Study', new Date(2026, 8, 4, 16, 0), new Date(2026, 8, 4, 17, 0));
    const snapshot = buildTodaySnapshot([later, soon], [], NOW);
    expect(snapshot.nextEvent?.title).toBe('Team Meeting');
    expect(snapshot.upcomingEvents.map((e) => e.title)).toEqual(['Study']);
  });

  it('does not treat an all-day event as current or next (but conflicts stay clear)', () => {
    const allDay = makeEvent(
      'Reading Week',
      new Date(2026, 8, 4, 0, 0),
      new Date(2026, 8, 5, 0, 0),
      { isAllDay: true },
    );
    const meeting = makeEvent('Team Meeting', new Date(2026, 8, 4, 11, 0), new Date(2026, 8, 4, 12, 0));
    const snapshot = buildTodaySnapshot([allDay, meeting], [], NOW);
    expect(snapshot.currentEvent).toBeNull();
    expect(snapshot.nextEvent?.title).toBe('Team Meeting');
    expect(snapshot.conflicts).toEqual([]);
  });

  it('ignores events on other days', () => {
    const yesterday = makeEvent('Yesterday', new Date(2026, 8, 3, 9, 0), new Date(2026, 8, 3, 10, 0));
    const tomorrow = makeEvent('Tomorrow', new Date(2026, 8, 5, 9, 0), new Date(2026, 8, 5, 10, 0));
    const snapshot = buildTodaySnapshot([yesterday, tomorrow], [], NOW);
    expect(snapshot.currentEvent).toBeNull();
    expect(snapshot.nextEvent).toBeNull();
    expect(snapshot.upcomingEvents).toEqual([]);
  });

  it('caps upcomingEvents at 5', () => {
    const events = Array.from({ length: 8 }, (_, i) =>
      makeEvent(`Event ${i}`, new Date(2026, 8, 4, 11 + i), new Date(2026, 8, 4, 11 + i, 30)),
    );
    const snapshot = buildTodaySnapshot(events, [], NOW);
    // events[0] is nextEvent, the remaining 7 are candidates for upcomingEvents, capped at 5.
    expect(snapshot.upcomingEvents).toHaveLength(5);
  });

  it('includes overdue todo tasks, oldest due date first, excludes completed', () => {
    const old = makeTask('Old', { dueDate: new Date(2026, 8, 1) });
    const recent = makeTask('Recent', { dueDate: new Date(2026, 8, 3) });
    const doneButOverdue = makeTask('Done', { dueDate: new Date(2026, 8, 1), status: 'completed' });
    const snapshot = buildTodaySnapshot([], [recent, old, doneButOverdue], NOW);
    expect(snapshot.overdueTasks.map((t) => t.title)).toEqual(['Old', 'Recent']);
  });

  it('includes high-priority and due-today tasks as priorityTasks, ordered by priority', () => {
    const high = makeTask('High priority', { priority: 'high' });
    const dueToday = makeTask('Due today', { priority: 'low', dueDate: new Date(2026, 8, 4, 20, 0) });
    const irrelevant = makeTask('Someday', { priority: 'low', dueDate: null });
    const snapshot = buildTodaySnapshot([], [high, dueToday, irrelevant], NOW);
    expect(snapshot.priorityTasks.map((t) => t.title)).toEqual(['High priority', 'Due today']);
  });

  it('never double-counts a task in both overdueTasks and priorityTasks', () => {
    const overdueAndHigh = makeTask('Overdue + high', { priority: 'high', dueDate: new Date(2026, 8, 1) });
    const snapshot = buildTodaySnapshot([], [overdueAndHigh], NOW);
    expect(snapshot.overdueTasks.map((t) => t.title)).toEqual(['Overdue + high']);
    expect(snapshot.priorityTasks).toEqual([]);
  });

  it('caps both task lists at 5', () => {
    const overdue = Array.from({ length: 8 }, (_, i) =>
      makeTask(`Overdue ${i}`, { dueDate: new Date(2026, 8, 1, i) }),
    );
    const highPriority = Array.from({ length: 8 }, (_, i) => makeTask(`High ${i}`, { priority: 'high' }));
    const snapshot = buildTodaySnapshot([], [...overdue, ...highPriority], NOW);
    expect(snapshot.overdueTasks).toHaveLength(5);
    expect(snapshot.priorityTasks).toHaveLength(5);
  });

  it('wires in conflicts, scoped to today only', () => {
    const a = makeEvent('Lecture', new Date(2026, 8, 4, 10, 0), new Date(2026, 8, 4, 12, 0));
    const b = makeEvent('Team Meeting', new Date(2026, 8, 4, 11, 0), new Date(2026, 8, 4, 12, 0));
    const snapshot = buildTodaySnapshot([a, b], [], NOW);
    expect(snapshot.conflicts).toHaveLength(1);
    expect([snapshot.conflicts[0].a.title, snapshot.conflicts[0].b.title].sort()).toEqual([
      'Lecture',
      'Team Meeting',
    ]);
  });

  describe('date rollover', () => {
    it('produces a different date/currentEvent when `now` crosses midnight', () => {
      const lateNight = new Date(2026, 8, 4, 23, 59);
      const justAfterMidnight = new Date(2026, 8, 5, 0, 1);
      const eveningEvent = makeEvent(
        'Late review',
        new Date(2026, 8, 4, 23, 0),
        new Date(2026, 8, 5, 0, 30),
      );

      const before = buildTodaySnapshot([eveningEvent], [], lateNight);
      const after = buildTodaySnapshot([eveningEvent], [], justAfterMidnight);

      expect(before.date).toBe('2026-09-04');
      expect(after.date).toBe('2026-09-05');
      // The event is still "current" for both instants (it spans midnight),
      // but it only counts as "today" relative to each instant's own day.
      expect(before.currentEvent?.title).toBe('Late review');
      expect(after.currentEvent?.title).toBe('Late review');
    });

    it('a task due "today" becomes overdue once `now` rolls to the next day', () => {
      const task = makeTask('Due tonight', { dueDate: new Date(2026, 8, 4, 22, 0) });
      const stillToday = buildTodaySnapshot([], [task], new Date(2026, 8, 4, 23, 0));
      const nextDay = buildTodaySnapshot([], [task], new Date(2026, 8, 5, 0, 30));

      expect(stillToday.overdueTasks).toEqual([]);
      expect(nextDay.overdueTasks.map((t) => t.title)).toEqual(['Due tonight']);
    });
  });
});
