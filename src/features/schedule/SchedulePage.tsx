import { useCallback, useEffect, useMemo, useState } from 'react';

import { CalendarGrid } from '../../components/CalendarGrid';
import { CalendarHeader } from '../../components/CalendarHeader';
import { InlineError } from '../../components/InlineError';
import { PageShell } from '../../components/PageShell';
import {
  DEFAULT_MONTH,
  computeHighlightedDates,
  monthGridDays,
  shiftMonth,
} from '../../lib/calendar';

import { AddScheduleForm } from './AddScheduleForm';
import { DaySchedulesPanel } from './DaySchedulesPanel';
import { scheduleApi } from './scheduleApi';
import type { ScheduleRecord } from './scheduleApi';

/**
 * SchedulePage
 *
 * Composes the Schedule_Manager surface: month header + calendar grid + the
 * per-day schedule panel, plus the "일정 추가" toolbar button that opens
 * `<AddScheduleForm>`.
 *
 * State (design.md § Schedule_Manager · React state):
 *   - `currentMonth`  : { year, month } — initialized to `DEFAULT_MONTH`
 *                       (2026년 7월, Requirement 2.2).
 *   - `selectedDate`  : ISO string of the day the user clicked on the grid,
 *                       or `null` when nothing is selected. Drives both the
 *                       grid selection outline and the DaySchedulesPanel
 *                       filter (Requirement 2.6).
 *   - `records`       : full Schedule_Record list from `scheduleApi.list()`.
 *                       Derived views (`highlightedDates`, day filter) are
 *                       computed with `useMemo` from this single source of
 *                       truth (Requirement 2.1, 2.4, 2.5).
 *   - `errorMsg`      : string surfaced as an `<InlineError>` banner above
 *                       the day panel. Set on fetch failure or bubbled up
 *                       from child mutations (Requirement 2.12).
 *   - `showAddForm`   : boolean for the AddScheduleForm dialog visibility.
 *
 * Data flow contract with children (Requirement 2.12 — 이전 상태 유지 원칙):
 *   - Mutations happen inside `AddScheduleForm` and `DaySchedulesPanel`. This
 *     page never touches `records` locally on mutation attempt; it only
 *     replaces the whole list once `refetch()` has succeeded. As a result a
 *     failed create/update/delete leaves `records` byte-identical to its
 *     pre-request value while `errorMsg` renders the standardized message.
 */
export function SchedulePage() {
  const [currentMonth, setCurrentMonth] = useState(DEFAULT_MONTH);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [records, setRecords] = useState<ScheduleRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  /**
   * Load the full Schedule_Record set. On success `errorMsg` is cleared so a
   * successful refetch after a failed mutation dismisses the previous banner.
   * On failure `records` is preserved (setRecords is not called) which honors
   * the "이전 상태 유지" invariant from Requirement 2.12.
   */
  const refetch = useCallback(async () => {
    try {
      const rows = await scheduleApi.list();
      setRecords(rows);
      setErrorMsg(null);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : '데이터를 불러오지 못했습니다.';
      setErrorMsg(message);
    }
  }, []);

  // Initial fetch on mount. `refetch` is a stable callback (empty deps).
  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleChangeMonth = useCallback((delta: -1 | 1) => {
    setCurrentMonth((m) => shiftMonth(m, delta));
  }, []);

  /**
   * 달력 셀 더블클릭 시 호출된다. 해당 날짜를 선택 상태로 만들고 일정 추가
   * 모달을 연다(Requirement 2.8-a — 선택 날짜가 폼에 프리필된다).
   */
  const handleActivateDate = useCallback((iso: string) => {
    setSelectedDate(iso);
    setShowAddForm(true);
  }, []);

  // 7의 배수 길이 셀 배열 (leading/trailing 셀 포함).
  const days = useMemo(
    () => monthGridDays(currentMonth.year, currentMonth.month),
    [currentMonth],
  );

  // 표시 월에 속하는 Wed_date의 distinct 집합. Property 20 규칙에 따라
  // 순수 함수로 계산되며 records 또는 currentMonth 변경 시에만 재계산된다.
  const highlightedDates = useMemo(
    () => computeHighlightedDates(records, currentMonth.year, currentMonth.month),
    [records, currentMonth],
  );

  return (
    <PageShell title="일정" className="page-wide">
      {errorMsg && <InlineError>{errorMsg}</InlineError>}

      <div className="schedule-layout">
        <div className="schedule-detail">
          <DaySchedulesPanel
            selectedDate={selectedDate}
            records={records}
            onMutate={refetch}
            onError={setErrorMsg}
          />
        </div>

        <div className="schedule-calendar">
          <CalendarHeader
            year={currentMonth.year}
            month={currentMonth.month}
            onChangeMonth={handleChangeMonth}
          />

          <CalendarGrid
            days={days}
            highlightedDates={highlightedDates}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onActivateDate={handleActivateDate}
          />

          <p className="schedule-hint">날짜를 더블클릭하면 일정을 추가할 수 있습니다.</p>
        </div>
      </div>

      <AddScheduleForm
        isOpen={showAddForm}
        initialDate={selectedDate ?? ''}
        onSave={async () => {
          await refetch();
          setShowAddForm(false);
        }}
        onCancel={() => setShowAddForm(false)}
      />
    </PageShell>
  );
}
