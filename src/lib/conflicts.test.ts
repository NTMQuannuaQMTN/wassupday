import { detectConflicts } from '@/lib/conflicts';
import type { CalendarEvent } from '@/types/models';

let seq = 0;
function makeEvent(
  title: string,
  startHour: number,
  endHour: number,
  opts: { isAllDay?: boolean } = {},
): CalendarEvent {
  seq += 1;
  const day = '2026-09-04';
  const pad = (h: number) => `${h}`.padStart(2, '0');
  return {
    id: `e${seq}`,
    userId: 'u1',
    title,
    description: null,
    startTime: `${day}T${pad(startHour)}:00:00.000Z`,
    endTime: `${day}T${pad(endHour)}:00:00.000Z`,
    location: null,
    category: 'other',
    source: 'manual',
    isAllDay: opts.isAllDay,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

beforeEach(() => {
  seq = 0;
});

describe('detectConflicts', () => {
  it('returns [] for no events', () => {
    expect(detectConflicts([])).toEqual([]);
  });

  it('returns [] for a single event', () => {
    expect(detectConflicts([makeEvent('Solo', 9, 10)])).toEqual([]);
  });

  it('detects a simple overlap with the correct overlap window', () => {
    const lecture = makeEvent('Lecture', 10, 12);
    const meeting = makeEvent('Meeting', 11, 13);
    const conflicts = detectConflicts([lecture, meeting]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].a.title).toBe('Lecture');
    expect(conflicts[0].b.title).toBe('Meeting');
    expect(conflicts[0].overlapStart).toBe('2026-09-04T11:00:00.000Z');
    expect(conflicts[0].overlapEnd).toBe('2026-09-04T12:00:00.000Z');
  });

  it('does not count touching edges as a conflict', () => {
    const first = makeEvent('First', 9, 10);
    const second = makeEvent('Second', 10, 11);
    expect(detectConflicts([first, second])).toEqual([]);
  });

  it('detects a fully nested event, spanning the nested event range', () => {
    const outer = makeEvent('Outer', 9, 17);
    const inner = makeEvent('Inner', 12, 13);
    const conflicts = detectConflicts([outer, inner]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].overlapStart).toBe('2026-09-04T12:00:00.000Z');
    expect(conflicts[0].overlapEnd).toBe('2026-09-04T13:00:00.000Z');
  });

  it('detects identical ranges as a conflict', () => {
    const a = makeEvent('A', 9, 10);
    const b = makeEvent('B', 9, 10);
    const conflicts = detectConflicts([a, b]);
    expect(conflicts).toHaveLength(1);
  });

  it('finds exactly the overlapping pairs among several events, no duplicates', () => {
    const morning = makeEvent('Morning', 8, 9); // isolated
    const a = makeEvent('A', 10, 12);
    const b = makeEvent('B', 11, 13); // overlaps A
    const c = makeEvent('C', 14, 15); // isolated
    const d = makeEvent('D', 12, 16); // overlaps B and C

    const conflicts = detectConflicts([morning, a, b, c, d]);
    const pairs = conflicts
      .map(({ a: x, b: y }) => [x.title, y.title].sort().join('+'))
      .sort();

    expect(pairs).toEqual(['A+B', 'B+D', 'C+D'].sort());
  });

  it('ignores all-day events — they never clash with timed events', () => {
    const allDay = makeEvent('Reading Week', 0, 24, { isAllDay: true });
    const meeting = makeEvent('Meeting', 10, 11);
    expect(detectConflicts([allDay, meeting])).toEqual([]);
  });

  it('is order-independent — unsorted input yields the same result as sorted input', () => {
    const a = makeEvent('A', 10, 12);
    const b = makeEvent('B', 11, 13);
    const c = makeEvent('C', 9, 10);

    const fromSorted = detectConflicts([c, a, b]);
    const fromUnsorted = detectConflicts([b, c, a]);

    const normalize = (list: ReturnType<typeof detectConflicts>) =>
      list.map(({ a: x, b: y }) => [x.title, y.title].sort().join('+')).sort();

    expect(normalize(fromUnsorted)).toEqual(normalize(fromSorted));
  });
});
