import {
  endOfLocalDay,
  isSameLocalDay,
  isToday,
  minutesBetween,
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
});
