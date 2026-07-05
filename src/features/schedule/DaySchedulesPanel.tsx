import { DataTable } from '../../components/DataTable';
import type { DataTableColumn } from '../../components/DataTable';
import { scheduleApi } from './scheduleApi';
import type { ScheduleRecord } from './scheduleApi';

/**
 * DaySchedulesPanel (task 10.4)
 *
 * Presents the subset of Schedule_Record whose `Wed_date` matches the
 * currently selected calendar day, and exposes inline edit / delete
 * controls (Requirement 2.6, 2.10, 2.11, 2.13).
 *
 * State ownership:
 *  - The parent (SchedulePage) owns the full `records` list and the
 *    `selectedDate`. This panel is a pure derivation of those props —
 *    it does not fetch, cache, or locally mutate rows.
 *  - After a successful `update` / `remove` the panel calls `onMutate()`
 *    so the parent re-fetches and pushes fresh `records` down.
 *  - Errors bubble up via `onError` (typically wired to a page-level
 *    `<InlineError>`). Preserving the pre-mutation state on failure is
 *    delegated to `<DataTable>` (which never mutates rows on its own,
 *    honoring the "이전 상태 유지" contract from Requirement 2.12).
 */
export interface DaySchedulesPanelProps {
  /** ISO date string "YYYY-MM-DD" of the currently selected day, or null. */
  selectedDate: string | null;
  /** Full record list from `scheduleApi.list()` — filtered locally. */
  records: ScheduleRecord[];
  /** Invoked after a successful update/delete so the parent refetches. */
  onMutate: () => Promise<void> | void;
  /** Optional sink for surfacing update/delete failure messages. */
  onError?: (message: string) => void;
}

/**
 * Column configuration matching the task spec: 장소 · 시간 · 일정내용 · 메모.
 * `Wed_time` renders "-" when null; `Wed_note` renders "" when null.
 */
const columns: DataTableColumn<ScheduleRecord>[] = [
  {
    key: 'Wed_place',
    header: '장소',
  },
  {
    key: 'Wed_time',
    header: '시간',
    render: (row) => (row.Wed_time === null ? '-' : row.Wed_time),
  },
  {
    key: 'Wed_schedule',
    header: '일정내용',
  },
  {
    key: 'Wed_note',
    header: '메모',
    render: (row) => (row.Wed_note === null ? '' : row.Wed_note),
  },
];

export function DaySchedulesPanel(props: DaySchedulesPanelProps) {
  const { selectedDate, records, onMutate, onError } = props;

  // Placeholder — no date chosen yet.
  if (selectedDate === null) {
    return (
      <section className="day-schedules-panel day-schedules-panel--empty">
        <p className="day-schedules-placeholder">달력에서 날짜를 선택하세요.</p>
      </section>
    );
  }

  const rowsForDate = records.filter((r) => r.Wed_date === selectedDate);

  /**
   * Save handler: forward the accumulated patch to `scheduleApi.update` and,
   * on success, trigger the parent refetch. On failure re-throw so
   * `<DataTable>` keeps the row in edit mode and its own error path invokes
   * our `onError` (see DataTable's contract).
   */
  async function handleSaveEdit(
    id: string,
    patch: Partial<ScheduleRecord>,
  ): Promise<void> {
    await scheduleApi.update(id, patch);
    await onMutate();
  }

  /**
   * Delete handler: remove the row through the API, then refetch. Errors
   * are re-thrown so `<DataTable>` can route them into `onError`.
   */
  async function handleDelete(id: string): Promise<void> {
    await scheduleApi.remove(id);
    await onMutate();
  }

  return (
    <section className="day-schedules-panel">
      <h2>{selectedDate}</h2>
      <DataTable<ScheduleRecord>
        rows={rowsForDate}
        columns={columns}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onError={onError}
        emptyMessage="이 날짜에 등록된 일정이 없습니다"
      />
    </section>
  );
}
