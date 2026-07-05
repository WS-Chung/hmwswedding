/**
 * CalendarGrid
 *
 * 7 열(일~토) × N 행의 달력 grid. `days`(`monthGridDays`의 결과)를 순서대로
 * 셀 button으로 렌더링하며, ISO 문자열이 `highlightedDates`에 포함된 셀에는
 * `.has-schedule` 클래스를 부여한다. 셀 클릭 시 `onSelectDate(iso)` 호출.
 *
 * 규칙:
 *  - `inMonth: false` 셀은 `.day-cell-out` 으로 시각적으로 muted 처리
 *    (이전/다음 달 leading/trailing 셀).
 *  - `selectedDate === iso` 셀은 `.day-cell-selected`로 outline 강조.
 *  - `.has-schedule`는 `--primary` 토큰 기반 하이라이트 (Requirement 10.2 / 2.4).
 *
 * Requirements: 2.3, 2.4, 2.5, 2.6.
 * Property 20 검증에 사용되는 렌더링 규칙.
 */

import type { DayCell } from '../lib/calendar';

/** 일요일 시작 주간 헤더. */
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export interface CalendarGridProps {
  /** `monthGridDays(year, month)`의 결과 (길이는 7의 배수). */
  days: DayCell[];
  /** 하이라이트할 ISO 날짜 집합 (`computeHighlightedDates`의 결과). */
  highlightedDates: ReadonlySet<string>;
  /** 선택된 날짜의 ISO 문자열. 없으면 `null`/`undefined`. */
  selectedDate?: string | null;
  /** 셀 클릭 시 호출되는 콜백. */
  onSelectDate: (iso: string) => void;
}

/** "YYYY-MM-DD" → 1..31 정수. */
function dayNumberOf(iso: string): number {
  return Number(iso.slice(8, 10));
}

export function CalendarGrid({
  days,
  highlightedDates,
  selectedDate = null,
  onSelectDate,
}: CalendarGridProps) {
  return (
    <div>
      <div className="calendar-weekdays" role="row">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="calendar-weekday" role="columnheader">
            {label}
          </div>
        ))}
      </div>
      <div className="calendar-grid" role="grid">
        {days.map((cell) => {
          const classes = ['day-cell'];
          if (!cell.inMonth) classes.push('day-cell-out');
          if (highlightedDates.has(cell.iso)) classes.push('has-schedule');
          if (selectedDate === cell.iso) classes.push('day-cell-selected');
          return (
            <button
              key={cell.iso}
              type="button"
              className={classes.join(' ')}
              onClick={() => onSelectDate(cell.iso)}
              aria-label={cell.iso}
              aria-pressed={selectedDate === cell.iso}
            >
              {dayNumberOf(cell.iso)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
