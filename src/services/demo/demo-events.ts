/**
 * Demo event data source — the same surface as `services/events.ts`, backed by
 * the in-memory `demo-store` instead of Supabase. Validation is shared with the
 * real service.
 */

import { getDemoEvents, setDemoEvents } from '@/services/demo/demo-store';
import { validateEventInput, type EventInput, type ServiceResult } from '@/services/shared';
import type { CalendarEvent } from '@/types/models';

const ok = <T>(data: T): ServiceResult<T> => ({ data, error: null });

function genId(): string {
  return `demo-evt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Events overlapping the half-open window [fromISO, toISO), sorted by start. */
export async function listEventsInRange(
  fromISO: string,
  toISO: string,
): Promise<ServiceResult<CalendarEvent[]>> {
  const from = Date.parse(fromISO);
  const to = Date.parse(toISO);
  const list = getDemoEvents()
    .filter((e) => Date.parse(e.startTime) < to && Date.parse(e.endTime) > from)
    .sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
  return ok(list);
}

export async function getEvent(id: string): Promise<ServiceResult<CalendarEvent | null>> {
  return ok(getDemoEvents().find((e) => e.id === id) ?? null);
}

export async function createEvent(input: EventInput): Promise<ServiceResult<CalendarEvent>> {
  const err = validateEventInput(input);
  if (err) return { data: null, error: err };
  const nowIso = new Date().toISOString();
  const created: CalendarEvent = {
    id: genId(),
    userId: 'demo',
    title: input.title.trim(),
    description: input.description?.trim() || null,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location?.trim() || null,
    category: input.category ?? 'other',
    source: 'manual',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  setDemoEvents([...getDemoEvents(), created]);
  return ok(created);
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput>,
): Promise<ServiceResult<CalendarEvent>> {
  const err = validateEventInput(patch, { partial: true });
  if (err) return { data: null, error: err };
  const list = getDemoEvents();
  const existing = list.find((e) => e.id === id);
  if (!existing) return { data: null, error: 'Event not found.' };
  const updated: CalendarEvent = {
    ...existing,
    ...(patch.title !== undefined && { title: patch.title.trim() }),
    ...(patch.description !== undefined && {
      description: patch.description?.trim() || null,
    }),
    ...(patch.startTime !== undefined && { startTime: patch.startTime }),
    ...(patch.endTime !== undefined && { endTime: patch.endTime }),
    ...(patch.location !== undefined && { location: patch.location?.trim() || null }),
    ...(patch.category !== undefined && { category: patch.category }),
    updatedAt: new Date().toISOString(),
  };
  setDemoEvents(list.map((e) => (e.id === id ? updated : e)));
  return ok(updated);
}

export async function deleteEvent(id: string): Promise<ServiceResult<{ id: string }>> {
  setDemoEvents(getDemoEvents().filter((e) => e.id !== id));
  return ok({ id });
}
