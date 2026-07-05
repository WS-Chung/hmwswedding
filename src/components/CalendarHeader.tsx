/**
 * CalendarHeader
 *
 * Schedule 페이지 상단의 월 표시 + 이동 컨트롤. 표시월(YYYY년 M월) 라벨과
 * 좌우 pill secondary 버튼 두 개로 구성되며, 각 버튼은 부모에 대해
 * `onChangeMonth(-1 | 1)`을 호출한다.
 *
 * Requirements:
 *  - 2.3 이전 월 / 다음 월 이동 컨트롤 제공
 *
 * Design reference: design.md § "Schedule_Manager" / "공통 컴포넌트".
 */

import { PillButton } from './PillButton';

export interface CalendarHeaderProps {
  /** 4자리 그레고리력 연도. */
  year: number;
  /** 1..12 (1-indexed). */
  month: number;
  /** 월 이동 delta (-1 = 이전 달, +1 = 다음 달). */
  onChangeMonth: (delta: -1 | 1) => void;
}

export function CalendarHeader({ year, month, onChangeMonth }: CalendarHeaderProps) {
  return (
    <div className="calendar-header">
      <PillButton
        variant="secondary"
        aria-label="이전 달"
        onClick={() => onChangeMonth(-1)}
      >
        ◀
      </PillButton>
      <h2 className="calendar-month-label">
        {year}년 {month}월
      </h2>
      <PillButton
        variant="secondary"
        aria-label="다음 달"
        onClick={() => onChangeMonth(1)}
      >
        ▶
      </PillButton>
    </div>
  );
}
