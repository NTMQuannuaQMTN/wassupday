/**
 * Realistic demo data, anchored to `now` so the Today screen always has a
 * current event, a next event, a conflict, an overdue task and so on — whatever
 * time the demo is run. Pure: `now` is a parameter, no I/O.
 *
 * Student / productivity flavour (NUS modules) per the product brief.
 */

import type { CalendarEvent, Task } from '@/types/models';

const MIN = 60_000;

function at(now: Date, offsetMinutes: number): string {
  return new Date(now.getTime() + offsetMinutes * MIN).toISOString();
}

/** A fixed clock time today (or on a later day), regardless of `now`. */
function todayAt(now: Date, dayOffset: number, hour: number, minute = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function event(
  id: string,
  title: string,
  startTime: string,
  endTime: string,
  category: CalendarEvent['category'],
  location: string | null = null,
): CalendarEvent {
  return {
    id,
    userId: 'demo',
    title,
    description: null,
    startTime,
    endTime,
    location,
    category,
    source: 'manual',
    createdAt: startTime,
    updatedAt: startTime,
  };
}

export function buildDemoEvents(now: Date): CalendarEvent[] {
  return [
    // Earlier today — already finished, shows greyed in the timeline.
    event('demo-evt-breakfast', 'Breakfast with Alex', at(now, -210), at(now, -165), 'social', 'The Deck'),

    // Happening right now — drives the NOW card.
    event('demo-evt-cs1231s', 'CS1231S Lecture', at(now, -25), at(now, 35), 'class', 'LT19'),

    // Next up — and it overlaps the consultation below (CONFLICTS demo).
    event('demo-evt-team', 'Team Meeting', at(now, 70), at(now, 130), 'meeting', 'COM1-0201'),
    event('demo-evt-ma1521-consult', 'MA1521 Consultation', at(now, 100), at(now, 160), 'class', 'S17-0404'),

    // Later today.
    event('demo-evt-gym', 'Gym', todayAt(now, 0, 18, 30), todayAt(now, 0, 19, 30), 'health', 'USC'),
    event('demo-evt-study', 'CS1231S problem set', todayAt(now, 0, 20, 30), todayAt(now, 0, 22), 'personal'),

    // Tomorrow.
    event('demo-evt-cs2040s', 'CS2040S Tutorial', todayAt(now, 1, 10), todayAt(now, 1, 11), 'class', 'COM1-B103'),
    event('demo-evt-project', 'Project work — GEA1000', todayAt(now, 1, 14), todayAt(now, 1, 17), 'personal', 'CLB'),

    // In two days.
    event('demo-evt-ma1521-mid', 'MA1521 Midterm', todayAt(now, 2, 9), todayAt(now, 2, 11), 'class', 'MPSH1'),
  ];
}

function task(
  now: Date,
  id: string,
  title: string,
  overrides: Partial<Task>,
): Task {
  const nowIso = now.toISOString();
  return {
    id,
    userId: 'demo',
    title,
    description: null,
    dueDate: null,
    priority: 'medium',
    estimatedDuration: null,
    status: 'todo',
    source: 'manual',
    createdAt: nowIso,
    updatedAt: nowIso,
    ...overrides,
  };
}

export function buildDemoTasks(now: Date): Task[] {
  return [
    task(now, 'demo-task-cs1231s', 'Finish CS1231S Assignment 3', {
      dueDate: todayAt(now, 0, 23, 59),
      priority: 'high',
      estimatedDuration: 120,
    }),
    task(now, 'demo-task-ma1521', 'Prep MA1521 tutorial questions', {
      dueDate: todayAt(now, 0, 18),
      priority: 'medium',
      estimatedDuration: 45,
    }),
    task(now, 'demo-task-cs2040s-lab', 'Submit CS2040S Lab 2', {
      dueDate: todayAt(now, -1, 23, 59),
      priority: 'high',
    }),
    task(now, 'demo-task-email', 'Reply to Prof. Tan about the project scope', {
      priority: 'medium',
    }),
    task(now, 'demo-task-room', 'Book a group study room for GEA1000', {
      dueDate: todayAt(now, 2, 12),
      priority: 'low',
    }),
    task(now, 'demo-task-reading', 'Read CS1231S Chapter 4', {
      status: 'completed',
      priority: 'medium',
      updatedAt: at(now, -120),
    }),
  ];
}
