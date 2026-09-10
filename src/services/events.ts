/**
 * Events data access. Wraps supabase-js (parameterized / PostgREST) and maps
 * between DB rows (`snake_case`, `src/types/database.ts`) and domain models
 * (`camelCase`, `src/types/models.ts`). No UI or React here.
 *
 * `user_id` is never sent from the client — the column defaults to `auth.uid()`
 * and RLS re-checks it. Callers cannot create or read another user's events.
 */

import { supabase } from '@/lib/supabase';
import { validateEventInput, type EventInput, type ServiceResult } from '@/services/shared';
import type { EventRow } from '@/types/database';
import type { CalendarEvent } from '@/types/models';

export { validateEventInput };
export type { EventInput, ServiceResult };

const GENERIC = 'Something went wrong. Please try again.';

const EVENT_COLUMNS =
  'id,user_id,title,description,start_time,end_time,location,category,source,created_at,updated_at';

export function rowToEvent(row: EventRow): CalendarEvent {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    category: row.category,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRowFields(input: Partial<EventInput>) {
  const fields: Partial<Omit<EventRow, 'id' | 'user_id' | 'created_at' | 'updated_at'>> = {};
  if (input.title !== undefined) fields.title = input.title.trim();
  if (input.description !== undefined) {
    fields.description = input.description?.trim() ? input.description.trim() : null;
  }
  if (input.startTime !== undefined) fields.start_time = input.startTime;
  if (input.endTime !== undefined) fields.end_time = input.endTime;
  if (input.location !== undefined) {
    fields.location = input.location?.trim() ? input.location.trim() : null;
  }
  if (input.category !== undefined) fields.category = input.category;
  return fields;
}

function fail(context: string, error: unknown): { data: null; error: string } {
  if (__DEV__) console.warn(`[events] ${context}:`, error);
  return { data: null, error: GENERIC };
}

/**
 * Events overlapping the half-open window [fromISO, toISO): an event counts if it
 * starts before the window ends and ends after the window starts. Ordered by
 * start time.
 */
export async function listEventsInRange(
  fromISO: string,
  toISO: string,
): Promise<ServiceResult<CalendarEvent[]>> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_COLUMNS)
      .lt('start_time', toISO)
      .gt('end_time', fromISO)
      .order('start_time', { ascending: true });
    if (error) return fail('listEventsInRange', error);
    return { data: (data as EventRow[]).map(rowToEvent), error: null };
  } catch (err) {
    return fail('listEventsInRange', err);
  }
}

export async function getEvent(id: string): Promise<ServiceResult<CalendarEvent | null>> {
  try {
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) return fail('getEvent', error);
    return { data: data ? rowToEvent(data as EventRow) : null, error: null };
  } catch (err) {
    return fail('getEvent', err);
  }
}

export async function createEvent(input: EventInput): Promise<ServiceResult<CalendarEvent>> {
  const validation = validateEventInput(input);
  if (validation) return { data: null, error: validation };
  try {
    // `user_id` is intentionally omitted — the column defaults to auth.uid()
    // and RLS re-checks it.
    const { data, error } = await supabase
      .from('events')
      .insert({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        start_time: input.startTime,
        end_time: input.endTime,
        location: input.location?.trim() || null,
        category: input.category ?? 'other',
      })
      .select(EVENT_COLUMNS)
      .single();
    if (error) return fail('createEvent', error);
    return { data: rowToEvent(data as EventRow), error: null };
  } catch (err) {
    return fail('createEvent', err);
  }
}

export async function updateEvent(
  id: string,
  patch: Partial<EventInput>,
): Promise<ServiceResult<CalendarEvent>> {
  const validation = validateEventInput(patch, { partial: true });
  if (validation) return { data: null, error: validation };
  try {
    const { data, error } = await supabase
      .from('events')
      .update(toRowFields(patch))
      .eq('id', id)
      .select(EVENT_COLUMNS)
      .single();
    if (error) return fail('updateEvent', error);
    return { data: rowToEvent(data as EventRow), error: null };
  } catch (err) {
    return fail('updateEvent', err);
  }
}

export async function deleteEvent(id: string): Promise<ServiceResult<{ id: string }>> {
  try {
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) return fail('deleteEvent', error);
    return { data: { id }, error: null };
  } catch (err) {
    return fail('deleteEvent', err);
  }
}

