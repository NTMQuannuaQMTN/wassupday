/**
 * In-memory store for the demo data source. Seeded lazily on first read (so the
 * anchor time is "when the app first needed data"), mutated by the demo CRUD
 * modules. Resets on JS reload — which is fine, and handy, for a demo.
 *
 * The screens' existing `notifyEventsChanged` / `notifyTasksChanged` pub/sub
 * already drives UI refresh after a mutation, so this store only needs
 * get/set.
 */

import { buildDemoEvents, buildDemoTasks } from '@/services/demo/demo-seed';
import type { CalendarEvent, Task } from '@/types/models';

let events: CalendarEvent[] | null = null;
let tasks: Task[] | null = null;

export function getDemoEvents(): CalendarEvent[] {
  if (events === null) events = buildDemoEvents(new Date());
  return events;
}

export function setDemoEvents(next: CalendarEvent[]): void {
  events = next;
}

export function getDemoTasks(): Task[] {
  if (tasks === null) tasks = buildDemoTasks(new Date());
  return tasks;
}

export function setDemoTasks(next: Task[]): void {
  tasks = next;
}

/** Test-only: force a fresh seed. */
export function resetDemoStore(): void {
  events = null;
  tasks = null;
}
