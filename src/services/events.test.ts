/**
 * Event service tests. Pure mapping + validation are tested directly; the
 * Supabase query builder is mocked to assert we never send `user_id` and that
 * inputs are trimmed.
 */
/* eslint-disable import/first -- imports must follow jest.mock() */

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));

import {
  createEvent,
  rowToEvent,
  updateEvent,
  validateEventInput,
  type EventInput,
} from '@/services/events';
import type { EventRow } from '@/types/database';

const row: EventRow = {
  id: 'e1',
  user_id: 'u1',
  title: 'CS1231S Lecture',
  description: null,
  start_time: '2026-09-04T09:00:00.000Z',
  end_time: '2026-09-04T11:00:00.000Z',
  location: 'LT19',
  category: 'class',
  source: 'manual',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

const validInput: EventInput = {
  title: 'Team Meeting',
  startTime: '2026-09-04T11:00:00.000Z',
  endTime: '2026-09-04T12:00:00.000Z',
};

/** Minimal thenable chain that records the insert/update payload. */
function mockChain(result: { data: unknown; error: unknown }) {
  const captured: { insert?: unknown; update?: unknown } = {};
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'lt', 'gt', 'order', 'maybeSingle']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.insert = jest.fn((v: unknown) => {
    captured.insert = v;
    return chain;
  });
  chain.update = jest.fn((v: unknown) => {
    captured.update = v;
    return chain;
  });
  return { chain, captured };
}

beforeEach(() => jest.clearAllMocks());

describe('rowToEvent', () => {
  it('maps snake_case row to camelCase model', () => {
    expect(rowToEvent(row)).toEqual({
      id: 'e1',
      userId: 'u1',
      title: 'CS1231S Lecture',
      description: null,
      startTime: '2026-09-04T09:00:00.000Z',
      endTime: '2026-09-04T11:00:00.000Z',
      location: 'LT19',
      category: 'class',
      source: 'manual',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
  });
});

describe('validateEventInput', () => {
  it('accepts a well-formed event', () => {
    expect(validateEventInput(validInput)).toBeNull();
  });

  it('rejects an empty or missing title', () => {
    expect(validateEventInput({ ...validInput, title: '   ' })).toMatch(/title/i);
  });

  it('rejects end before start', () => {
    expect(
      validateEventInput({
        ...validInput,
        startTime: '2026-09-04T12:00:00.000Z',
        endTime: '2026-09-04T11:00:00.000Z',
      }),
    ).toMatch(/ends before it starts/i);
  });

  it('rejects an over-long description', () => {
    expect(validateEventInput({ ...validInput, description: 'x'.repeat(2001) })).toMatch(/too long/i);
  });

  it('in partial mode, only validates the fields present', () => {
    expect(validateEventInput({ title: 'New title' }, { partial: true })).toBeNull();
    expect(validateEventInput({ title: '' }, { partial: true })).toMatch(/title/i);
  });
});

describe('createEvent', () => {
  it('never sends user_id and trims text fields', async () => {
    const { chain, captured } = mockChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await createEvent({
      title: '  Team Meeting  ',
      description: '   ',
      location: '  Room 3  ',
      startTime: validInput.startTime,
      endTime: validInput.endTime,
      category: 'meeting',
    });

    expect(captured.insert).toEqual({
      title: 'Team Meeting',
      description: null,
      location: 'Room 3',
      start_time: validInput.startTime,
      end_time: validInput.endTime,
      category: 'meeting',
    });
    expect(JSON.stringify(captured.insert)).not.toMatch(/user_id/);
  });

  it('does not hit the network when validation fails', async () => {
    const res = await createEvent({ ...validInput, title: '' });
    expect(res.error).toMatch(/title/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('updateEvent', () => {
  it('sends only the changed fields, never user_id', async () => {
    const { chain, captured } = mockChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await updateEvent('e1', { title: 'Renamed' });

    expect(captured.update).toEqual({ title: 'Renamed' });
    expect(JSON.stringify(captured.update)).not.toMatch(/user_id/);
  });
});
