import {
  endOfLocalDay,
  formatClock,
  formatRelativeFuture,
  isSameLocalDay,
  isToday,
  localDayRangeIso,
  minutesBetween,
  minutesSinceLocalMidnight,
  parseDateKey,
  startOfLocalDay,
  toLocalDateKey,
} from '@/lib/time';

describe('time helpers', () => {
  describe('toLocalDateKey', () => {
    it('formats a date as YYYY-MM-DD with zero padding', () => {
      expect(toLocalDateKey(new Date(2026, 0, 5, 9, 30))).toBe('2026-01-05');
    });

    it('accepts an ISO string', () => {
      const iso = new Date(2026, 8, 2, 23, 59).toISOString();
      expect(toLocalDateKey(iso)).toBe('2026-09-02');
    });
  });

  describe('isSameLocalDay', () => {
    it('is true across different times of the same day', () => {
      expect(isSameLocalDay(new Date(2026, 8, 2, 0, 1), new Date(2026, 8, 2, 23, 58))).toBe(true);
    });

    it('is false across a midnight boundary', () => {
      // 23:59 Tuesday vs 00:00 Wednesday
      expect(isSameLocalDay(new Date(2026, 8, 1, 23, 59), new Date(2026, 8, 2, 0, 0))).toBe(false);
    });
  });

  describe('isToday', () => {
    it('compares against an explicit reference instant', () => {
      const reference = new Date(2026, 8, 2, 8, 0);
      expect(isToday(new Date(2026, 8, 2, 20, 0), reference)).toBe(true);
      expect(isToday(new Date(2026, 8, 3, 0, 5), reference)).toBe(false);
    });
  });

  describe('minutesBetween', () => {
    it('returns positive whole minutes for a future instant', () => {
      const from = new Date(2026, 8, 2, 8, 18);
      const to = new Date(2026, 8, 2, 9, 0);
      expect(minutesBetween(from, to)).toBe(42);
    });

    it('returns negative minutes for a past instant', () => {
      const from = new Date(2026, 8, 2, 9, 0);
      const to = new Date(2026, 8, 2, 8, 30);
      expect(minutesBetween(from, to)).toBe(-30);
    });

    it('truncates towards zero rather than rounding up', () => {
      const from = new Date(2026, 8, 2, 8, 0, 0);
      const to = new Date(2026, 8, 2, 8, 0, 59);
      expect(minutesBetween(from, to)).toBe(0);
    });
  });

  describe('day boundaries', () => {
    it('startOfLocalDay is midnight', () => {
      const start = startOfLocalDay(new Date(2026, 8, 2, 14, 30, 15));
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);
    });

    it('endOfLocalDay is the last millisecond of the day', () => {
      const end = endOfLocalDay(new Date(2026, 8, 2, 1, 0));
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });
  });

  describe('parseDateKey', () => {
    it('parses to local midnight', () => {
      const d = parseDateKey('2026-09-04');
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 4]);
      expect(d.getHours()).toBe(0);
    });
  });

  describe('localDayRangeIso', () => {
    it('covers exactly one local day by default', () => {
      const { fromISO, toISO } = localDayRangeIso('2026-09-04');
      expect(new Date(toISO).getTime() - new Date(fromISO).getTime()).toBe(24 * 60 * 60 * 1000);
      expect(toLocalDateKey(fromISO)).toBe('2026-09-04');
    });

    it('extends forward by `days`', () => {
      const { fromISO, toISO } = localDayRangeIso('2026-09-04', 7);
      expect(new Date(toISO).getTime() - new Date(fromISO).getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe('minutesSinceLocalMidnight', () => {
    it('counts hours and minutes', () => {
      expect(minutesSinceLocalMidnight(new Date(2026, 8, 4, 9, 30))).toBe(570);
      expect(minutesSinceLocalMidnight(new Date(2026, 8, 4, 0, 0))).toBe(0);
    });
  });

  describe('formatClock', () => {
    it.each([
      [new Date(2026, 8, 4, 9, 0), '9 AM'],
      [new Date(2026, 8, 4, 9, 5), '9:05 AM'],
      [new Date(2026, 8, 4, 0, 0), '12 AM'],
      [new Date(2026, 8, 4, 12, 0), '12 PM'],
      [new Date(2026, 8, 4, 14, 15), '2:15 PM'],
    ])('%s -> %s', (d, expected) => {
      expect(formatClock(d)).toBe(expected);
    });
  });

  describe('formatRelativeFuture', () => {
    const now = new Date(2026, 8, 4, 8, 18);
    it.each([
      [new Date(2026, 8, 4, 9, 0), 'in 42 minutes'],
      [new Date(2026, 8, 4, 8, 19), 'in 1 minute'],
      [new Date(2026, 8, 4, 11, 18), 'in 3 hours'],
      [new Date(2026, 8, 6, 8, 18), 'in 2 days'],
      [new Date(2026, 8, 4, 8, 0), 'now'],
    ])('%s -> %s', (to, expected) => {
      expect(formatRelativeFuture(now, to)).toBe(expected);
    });
  });
});
