// Unit tests for the pure calendar utilities.
//
// These are example-based tests focused on the core functional logic of
// `shiftMonth`, `monthGridDays`, and `computeHighlightedDates`. The
// property-based tests for `computeHighlightedDates` (Property 20) live in
// task 5.7 and are intentionally not duplicated here.
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_MONTH,
  computeHighlightedDates,
  monthGridDays,
  shiftMonth,
} from './calendar';

describe('DEFAULT_MONTH', () => {
  it('is fixed at 2026년 7월 (Requirement 2.2)', () => {
    expect(DEFAULT_MONTH).toEqual({ year: 2026, month: 7 });
  });
});

describe('shiftMonth', () => {
  it('increments month within the same year', () => {
    expect(shiftMonth({ year: 2026, month: 7 }, 1)).toEqual({ year: 2026, month: 8 });
  });

  it('decrements month within the same year', () => {
    expect(shiftMonth({ year: 2026, month: 7 }, -1)).toEqual({ year: 2026, month: 6 });
  });

  it('rolls Dec → Jan and advances the year', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it('rolls Jan → Dec and decrements the year', () => {
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it('does not mutate its input', () => {
    const input = { year: 2026, month: 7 };
    const snapshot = { ...input };
    shiftMonth(input, 1);
    shiftMonth(input, -1);
    expect(input).toEqual(snapshot);
  });
});

describe('monthGridDays', () => {
  it('returns a length that is always a multiple of 7', () => {
    for (let month = 1; month <= 12; month++) {
      const grid = monthGridDays(2026, month);
      expect(grid.length % 7).toBe(0);
    }
  });

  it('covers every day of the target month with inMonth:true', () => {
    // July 2026 has 31 days.
    const grid = monthGridDays(2026, 7);
    const inMonthIsos = grid.filter((c) => c.inMonth).map((c) => c.iso);
    expect(inMonthIsos).toHaveLength(31);
    expect(inMonthIsos[0]).toBe('2026-07-01');
    expect(inMonthIsos[30]).toBe('2026-07-31');
  });

  it('marks leading and trailing days as inMonth:false', () => {
    const grid = monthGridDays(2026, 7);
    // July 1, 2026 is a Wednesday (dayOfWeek 3). Three leading cells expected.
    const firstInMonthIdx = grid.findIndex((c) => c.inMonth);
    expect(firstInMonthIdx).toBe(3);
    for (let i = 0; i < firstInMonthIdx; i++) {
      expect(grid[i].inMonth).toBe(false);
    }
    const lastInMonthIdx =
      grid.length - 1 - [...grid].reverse().findIndex((c) => c.inMonth);
    for (let i = lastInMonthIdx + 1; i < grid.length; i++) {
      expect(grid[i].inMonth).toBe(false);
    }
  });

  it('uses Sunday-start week ordering (dayOfWeek 0..6 repeating)', () => {
    const grid = monthGridDays(2026, 7);
    for (let i = 0; i < grid.length; i++) {
      expect(grid[i].dayOfWeek).toBe(i % 7);
    }
  });

  it('emits zero-padded ISO strings for single-digit months and days', () => {
    const grid = monthGridDays(2026, 3);
    const march1 = grid.find((c) => c.inMonth);
    expect(march1?.iso).toBe('2026-03-01');
    expect(grid.every((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.iso))).toBe(true);
  });

  it('handles month boundaries (leading from prev month, trailing from next)', () => {
    // July 2026: Jul 1 is a Wednesday, so 3 leading cells come from June 2026,
    // and 1 trailing cell from August 2026 rounds the grid to a multiple of 7.
    const jul = monthGridDays(2026, 7);
    // Leading cells belong to June 2026.
    expect(jul[0].inMonth).toBe(false);
    expect(jul[0].iso.startsWith('2026-06-')).toBe(true);
    expect(jul[2].iso).toBe('2026-06-30');
    // First in-month cell is July 1.
    expect(jul[3].iso).toBe('2026-07-01');
    expect(jul[3].inMonth).toBe(true);
    // Trailing cell belongs to August 2026.
    const last = jul[jul.length - 1];
    expect(last.inMonth).toBe(false);
    expect(last.iso).toBe('2026-08-01');
  });
});

describe('computeHighlightedDates', () => {
  it('returns only records whose Wed_date falls within (year, month)', () => {
    const records = [
      { Wed_date: '2026-07-01' },
      { Wed_date: '2026-07-15' },
      { Wed_date: '2026-06-30' }, // outside
      { Wed_date: '2026-08-01' }, // outside
      { Wed_date: '2025-07-15' }, // outside (different year)
    ];
    const result = computeHighlightedDates(records, 2026, 7);
    expect(result).toEqual(new Set(['2026-07-01', '2026-07-15']));
  });

  it('deduplicates identical Wed_date values', () => {
    const records = [
      { Wed_date: '2026-07-15' },
      { Wed_date: '2026-07-15' },
      { Wed_date: '2026-07-15' },
    ];
    const result = computeHighlightedDates(records, 2026, 7);
    expect(result.size).toBe(1);
    expect(result.has('2026-07-15')).toBe(true);
  });

  it('returns an empty Set when no records match', () => {
    const records = [{ Wed_date: '2025-01-01' }, { Wed_date: '2026-08-01' }];
    const result = computeHighlightedDates(records, 2026, 7);
    expect(result.size).toBe(0);
  });

  it('matches single-digit months via zero-padded prefix', () => {
    const records = [
      { Wed_date: '2026-03-05' },
      { Wed_date: '2026-03-10' },
      { Wed_date: '2026-10-05' }, // must not match March
    ];
    const result = computeHighlightedDates(records, 2026, 3);
    expect(result).toEqual(new Set(['2026-03-05', '2026-03-10']));
  });
});
