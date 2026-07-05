/**
 * Unit tests for <CalendarGrid> (Task 8.7).
 *
 * Focus (Property 20 pre-check):
 *  - Cells whose ISO is in `highlightedDates` receive the `.has-schedule`
 *    class.
 *  - Cells whose ISO is NOT in `highlightedDates` do NOT receive the class.
 *  - Clicking a cell invokes `onSelectDate` with that cell's ISO string.
 *
 * These are example-based assertions; the full biconditional over arbitrary
 * record arrays is covered by the calendar.ts property tests (Task 5.7).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import { CalendarGrid } from './CalendarGrid';
import type { DayCell } from '../lib/calendar';
import { monthGridDays } from '../lib/calendar';

describe('CalendarGrid', () => {
  it('applies .has-schedule to cells whose ISO is in highlightedDates', () => {
    const days: DayCell[] = monthGridDays(2026, 7);
    const highlighted = new Set<string>(['2026-07-01', '2026-07-15']);

    render(
      <CalendarGrid
        days={days}
        highlightedDates={highlighted}
        onSelectDate={() => {}}
      />,
    );

    const july01 = screen.getByRole('button', { name: '2026-07-01' });
    const july15 = screen.getByRole('button', { name: '2026-07-15' });
    expect(july01).toHaveClass('has-schedule');
    expect(july15).toHaveClass('has-schedule');
  });

  it('does NOT apply .has-schedule to cells whose ISO is not in highlightedDates', () => {
    const days: DayCell[] = monthGridDays(2026, 7);
    const highlighted = new Set<string>(['2026-07-15']);

    render(
      <CalendarGrid
        days={days}
        highlightedDates={highlighted}
        onSelectDate={() => {}}
      />,
    );

    // A different in-month date should not be highlighted.
    const july02 = screen.getByRole('button', { name: '2026-07-02' });
    expect(july02).not.toHaveClass('has-schedule');

    // The last day of the month should also not be highlighted.
    const july31 = screen.getByRole('button', { name: '2026-07-31' });
    expect(july31).not.toHaveClass('has-schedule');
  });

  it('calls onSelectDate with the cell ISO when clicked', () => {
    const days: DayCell[] = monthGridDays(2026, 7);
    const onSelectDate = vi.fn();

    render(
      <CalendarGrid
        days={days}
        highlightedDates={new Set<string>()}
        onSelectDate={onSelectDate}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '2026-07-10' }));
    expect(onSelectDate).toHaveBeenCalledTimes(1);
    expect(onSelectDate).toHaveBeenCalledWith('2026-07-10');
  });

  it('applies .day-cell-out to cells that are not in the target month', () => {
    // July 2026 starts on Wednesday (2026-07-01), so there are 3 leading
    // days from June (Sun/Mon/Tue). Grab the first one via its ISO.
    const days: DayCell[] = monthGridDays(2026, 7);
    const firstLeading = days.find((c) => !c.inMonth);
    expect(firstLeading).toBeDefined();

    render(
      <CalendarGrid
        days={days}
        highlightedDates={new Set<string>()}
        onSelectDate={() => {}}
      />,
    );

    const cell = screen.getByRole('button', { name: firstLeading!.iso });
    expect(cell).toHaveClass('day-cell-out');
  });

  it('marks the selectedDate cell with .day-cell-selected', () => {
    const days: DayCell[] = monthGridDays(2026, 7);

    render(
      <CalendarGrid
        days={days}
        highlightedDates={new Set<string>()}
        selectedDate="2026-07-20"
        onSelectDate={() => {}}
      />,
    );

    const selected = screen.getByRole('button', { name: '2026-07-20' });
    expect(selected).toHaveClass('day-cell-selected');
    expect(selected).toHaveAttribute('aria-pressed', 'true');

    const other = screen.getByRole('button', { name: '2026-07-21' });
    expect(other).not.toHaveClass('day-cell-selected');
    expect(other).toHaveAttribute('aria-pressed', 'false');
  });
});
