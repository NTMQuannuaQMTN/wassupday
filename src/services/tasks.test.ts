/**
 * Task service tests. Pure mapping + validation are tested directly; the
 * Supabase query builder is mocked to assert we never send `user_id` (or, on
 * create, `status`/`source`) and that inputs are trimmed.
 */
/* eslint-disable import/first -- imports must follow jest.mock() */

const mockFrom = jest.fn();
jest.mock('@/lib/supabase', () => ({ supabase: { from: (...a: unknown[]) => mockFrom(...a) } }));

import {
  createTask,
  rowToTask,
  setTaskStatus,
  updateTask,
  validateTaskInput,
  type TaskInput,
} from '@/services/tasks';
import type { TaskRow } from '@/types/database';

const row: TaskRow = {
  id: 't1',
  user_id: 'u1',
  title: 'Finish assignment',
  description: null,
  due_date: '2026-09-04T23:59:00.000Z',
  priority: 'high',
  estimated_duration: 90,
  status: 'todo',
  source: 'manual',
  created_at: '2026-09-01T00:00:00.000Z',
  updated_at: '2026-09-01T00:00:00.000Z',
};

const validInput: TaskInput = { title: 'Finish assignment' };

/** Minimal thenable chain that records the insert/update payload. */
function mockChain(result: { data: unknown; error: unknown }) {
  const captured: { insert?: unknown; update?: unknown } = {};
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'maybeSingle']) {
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

describe('rowToTask', () => {
  it('maps snake_case row to camelCase model', () => {
    expect(rowToTask(row)).toEqual({
      id: 't1',
      userId: 'u1',
      title: 'Finish assignment',
      description: null,
      dueDate: '2026-09-04T23:59:00.000Z',
      priority: 'high',
      estimatedDuration: 90,
      status: 'todo',
      source: 'manual',
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    });
  });
});

describe('validateTaskInput', () => {
  it('accepts a minimal well-formed task', () => {
    expect(validateTaskInput(validInput)).toBeNull();
  });

  it('rejects an empty or missing title', () => {
    expect(validateTaskInput({ ...validInput, title: '   ' })).toMatch(/title/i);
  });

  it('rejects an over-long description', () => {
    expect(validateTaskInput({ ...validInput, description: 'x'.repeat(2001) })).toMatch(/too long/i);
  });

  it('rejects an unparseable due date', () => {
    expect(validateTaskInput({ ...validInput, dueDate: 'not-a-date' })).toMatch(/due date/i);
  });

  it('accepts a null due date (no due date)', () => {
    expect(validateTaskInput({ ...validInput, dueDate: null })).toBeNull();
  });

  it.each([0, -5, 1441, 1.5])('rejects an out-of-range estimated duration: %s', (minutes) => {
    expect(validateTaskInput({ ...validInput, estimatedDuration: minutes })).toMatch(/duration/i);
  });

  it.each([1, 90, 1440])('accepts an in-range estimated duration: %s', (minutes) => {
    expect(validateTaskInput({ ...validInput, estimatedDuration: minutes })).toBeNull();
  });

  it('in partial mode, only validates the fields present', () => {
    expect(validateTaskInput({ title: 'New title' }, { partial: true })).toBeNull();
    expect(validateTaskInput({ title: '' }, { partial: true })).toMatch(/title/i);
  });
});

describe('createTask', () => {
  it('never sends user_id, status or source, and trims text fields', async () => {
    const { chain, captured } = mockChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await createTask({
      title: '  Finish assignment  ',
      description: '   ',
      dueDate: '2026-09-04T23:59:00.000Z',
      priority: 'high',
      estimatedDuration: 90,
    });

    expect(captured.insert).toEqual({
      title: 'Finish assignment',
      description: null,
      due_date: '2026-09-04T23:59:00.000Z',
      priority: 'high',
      estimated_duration: 90,
    });
    expect(JSON.stringify(captured.insert)).not.toMatch(/user_id|status|source/);
  });

  it('defaults priority to medium and due date to null when omitted', async () => {
    const { chain, captured } = mockChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await createTask({ title: 'Something' });

    expect(captured.insert).toMatchObject({ priority: 'medium', due_date: null });
  });

  it('does not hit the network when validation fails', async () => {
    const res = await createTask({ title: '' });
    expect(res.error).toMatch(/title/i);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('updateTask', () => {
  it('sends only the changed fields, never user_id/status/source', async () => {
    const { chain, captured } = mockChain({ data: row, error: null });
    mockFrom.mockReturnValue(chain);

    await updateTask('t1', { title: 'Renamed' });

    expect(captured.update).toEqual({ title: 'Renamed' });
    expect(JSON.stringify(captured.update)).not.toMatch(/user_id|status|source/);
  });
});

describe('setTaskStatus', () => {
  it('sends exactly { status }, nothing else', async () => {
    const { chain, captured } = mockChain({ data: { ...row, status: 'completed' }, error: null });
    mockFrom.mockReturnValue(chain);

    await setTaskStatus('t1', 'completed');

    expect(captured.update).toEqual({ status: 'completed' });
  });
});
