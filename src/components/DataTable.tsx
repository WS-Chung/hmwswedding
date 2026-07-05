import { useState } from 'react';
import type { ReactNode } from 'react';
import { PillButton } from './PillButton';

/**
 * DataTable
 *
 * Generic row-editing grid used by the Decision / Contact / Budget-item pages
 * (design.md § "공통 컴포넌트" → DataTable). Only one row may be in edit mode
 * at a time.
 *
 * Row identity is by `Wed_id` (Requirement 9.2 naming rule).
 *
 * Mutation contract (task 8.3):
 *  - Save / Delete are async and driven by the parent via `onSaveEdit` /
 *    `onDelete`. The parent owns the `rows` prop and is expected to refetch
 *    on success.
 *  - On failure the promise rejects: the visible `rows` are NEVER mutated
 *    from inside the table (preserving "이전 상태 유지" principle from
 *    Requirement 2.12 / design § "에러 처리 원칙"). The row simply stays in
 *    edit mode (save) or the dialog closes (delete). If an `onError`
 *    callback is provided, the caught error message is surfaced through it
 *    so the parent can render an `<InlineError>` banner.
 *
 * Column spec:
 *  - `key` doubles as (a) a React key for the cell and (b) the fallback
 *    property lookup used by the plain-text renderer / editor when
 *    `render` / `renderEdit` are omitted.
 *  - `render(row)` — read mode cell content override.
 *  - `renderEdit(row, patch, setPatch)` — edit mode cell content override.
 *    `patch` is the accumulated diff; `setPatch` replaces the diff (callers
 *    usually spread `{ ...patch, Wed_field: newValue }`).
 */
export interface DataTableColumn<T> {
  /** Property key (used as fallback for read/edit cells) or an opaque id. */
  key: keyof T | string;
  /** Column header label. */
  header: string;
  /** Optional custom cell renderer for view mode. */
  render?: (row: T) => ReactNode;
  /** Optional custom cell renderer for edit mode. */
  renderEdit?: (
    row: T,
    patch: Partial<T>,
    setPatch: (p: Partial<T>) => void,
  ) => ReactNode;
  /**
   * Optional fixed column width (any CSS length, e.g. "140px"). Applied via a
   * `<col>` so both the header and body cells share the same width. Columns
   * without a width share the remaining space.
   */
  width?: string;
  /**
   * Set `false` to disable click-to-sort on this column's header. Defaults to
   * sortable (true).
   */
  sortable?: boolean;
}

/** 현재 정렬 방향. */
type SortDir = 'asc' | 'desc';

export interface DataTableProps<T extends { Wed_id: string }> {
  rows: T[];
  columns: DataTableColumn<T>[];
  /** If provided, a top-right "추가" PillButton is rendered. */
  onAdd?: () => void;
  /** Called with the accumulated patch when 저장 is pressed. */
  onSaveEdit?: (id: string, patch: Partial<T>) => Promise<void>;
  /** Called after the user confirms in the delete dialog. */
  onDelete?: (id: string) => Promise<void>;
  /** Optional error sink used when Save/Delete promises reject. */
  onError?: (message: string) => void;
  /** Add-button label; defaults to "추가". */
  addLabel?: string;
  /** Empty-state message; defaults to "표시할 항목이 없습니다". */
  emptyMessage?: string;
}

/**
 * Best-effort read of a possibly-composite key from a row. Falls back to
 * `undefined` when the key does not exist on the row (e.g. a virtual column).
 */
function readCell<T>(row: T, key: keyof T | string): unknown {
  return (row as Record<string, unknown>)[key as string];
}

/**
 * Extract a user-facing error message from an unknown thrown value without
 * leaking `[object Object]` type stringification.
 */
function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return '요청을 처리할 수 없습니다.';
}

/**
 * 두 셀 값을 정렬용으로 비교한다(오름차순 기준).
 *  - null / undefined / 빈 문자열은 항상 뒤로 보낸다.
 *  - 두 값이 모두 숫자로 파싱되면 수치 비교(결제금액 등).
 *  - 그 외에는 한국어 로케일 문자열 비교(날짜 ISO 문자열은 사전식=시간순).
 */
function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  if (typeof a === 'number' && typeof b === 'number') return a - b;

  const as = String(a);
  const bs = String(b);
  const an = Number(as);
  const bn = Number(bs);
  if (as.trim() !== '' && bs.trim() !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) {
    return an - bn;
  }
  return as.localeCompare(bs, 'ko');
}

export function DataTable<T extends { Wed_id: string }>(
  props: DataTableProps<T>,
) {
  const {
    rows,
    columns,
    onAdd,
    onSaveEdit,
    onDelete,
    onError,
    addLabel = '추가',
    emptyMessage = '표시할 항목이 없습니다',
  } = props;

  const [editingId, setEditingId] = useState<string | null>(null);
  const [patch, setPatch] = useState<Partial<T>>({});
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 컬럼 헤더 클릭 정렬 상태. null이면 부모가 넘긴 순서를 그대로 사용한다.
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  /**
   * 헤더 클릭 시 정렬 상태를 순환시킨다: 미정렬 → 오름차순 → 내림차순 → 미정렬.
   */
  function toggleSort(key: string): void {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir('asc');
    }
  }

  // 표시용 정렬 행. 편집 중에도 안정적으로 동작하도록 얕은 복사 후 정렬한다.
  const displayRows =
    sortKey === null
      ? rows
      : [...rows].sort((ra, rb) => {
          const cmp = compareValues(readCell(ra, sortKey), readCell(rb, sortKey));
          return sortDir === 'asc' ? cmp : -cmp;
        });

  function beginEdit(row: T) {
    // Only one row may be in edit mode at a time (design constraint).
    setEditingId(row.Wed_id);
    setPatch({});
  }

  function cancelEdit() {
    setEditingId(null);
    setPatch({});
  }

  async function commitEdit(row: T) {
    if (!onSaveEdit || isSaving) return;
    setIsSaving(true);
    try {
      await onSaveEdit(row.Wed_id, patch);
      // Success: exit edit mode. The parent is expected to have refetched
      // `rows` so subsequent renders show the persisted values.
      setEditingId(null);
      setPatch({});
    } catch (err) {
      // Preserve edit mode + accumulated patch so the user can retry.
      if (onError) onError(extractMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function requestDelete(row: T) {
    setPendingDeleteId(row.Wed_id);
  }

  function cancelDelete() {
    if (isDeleting) return;
    setPendingDeleteId(null);
  }

  async function confirmDelete() {
    if (!onDelete || pendingDeleteId === null || isDeleting) return;
    const id = pendingDeleteId;
    setIsDeleting(true);
    try {
      await onDelete(id);
      setPendingDeleteId(null);
      // If the deleted row was being edited, exit edit mode too. (Defensive:
      // parent normally would not allow this state, but we clean up anyway.)
      if (editingId === id) {
        setEditingId(null);
        setPatch({});
      }
    } catch (err) {
      setPendingDeleteId(null);
      if (onError) onError(extractMessage(err));
    } finally {
      setIsDeleting(false);
    }
  }

  const columnCount = columns.length + 1; // +1 for the action column

  return (
    <div className="data-table-wrapper">
      {onAdd ? (
        <div className="data-table-toolbar">
          <PillButton onClick={onAdd} variant="primary">
            {addLabel}
          </PillButton>
        </div>
      ) : null}

      <table className="data-table">
        <colgroup>
          {columns.map((col) => (
            <col
              key={String(col.key)}
              style={col.width ? { width: col.width } : undefined}
            />
          ))}
          <col className="data-table-actions-col" />
        </colgroup>
        <thead>
          <tr>
            {columns.map((col) => {
              const key = String(col.key);
              const isSortable = col.sortable !== false;
              const isActive = sortKey === key;
              const ariaSort = !isActive
                ? undefined
                : sortDir === 'asc'
                  ? 'ascending'
                  : 'descending';
              return (
                <th key={key} scope="col" aria-sort={ariaSort}>
                  {isSortable ? (
                    <button
                      type="button"
                      className="data-table-sort-button"
                      onClick={() => toggleSort(key)}
                    >
                      {col.header}
                      <span className="data-table-sort-caret" aria-hidden="true">
                        {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
            <th scope="col" className="data-table-actions-header">
              <span className="visually-hidden">작업</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {displayRows.length === 0 ? (
            <tr>
              <td colSpan={columnCount} className="data-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            displayRows.map((row) => {
              const isEditing = editingId === row.Wed_id;
              return (
                <tr key={row.Wed_id} data-row-id={row.Wed_id}>
                  {columns.map((col) => {
                    const cellKey = String(col.key);
                    if (isEditing) {
                      // Edit-mode cell: custom renderEdit or plain input.
                      if (col.renderEdit) {
                        return (
                          <td key={cellKey}>
                            {col.renderEdit(row, patch, setPatch)}
                          </td>
                        );
                      }
                      const current =
                        (col.key as string) in patch
                          ? (patch as Record<string, unknown>)[
                              col.key as string
                            ]
                          : readCell(row, col.key);
                      const stringValue =
                        current === null || current === undefined
                          ? ''
                          : String(current);
                      return (
                        <td key={cellKey}>
                          <input
                            className="field-input data-table-edit-input"
                            type="text"
                            aria-label={col.header}
                            value={stringValue}
                            onChange={(e) =>
                              setPatch({
                                ...patch,
                                [col.key as string]: e.target.value,
                              } as Partial<T>)
                            }
                          />
                        </td>
                      );
                    }
                    // Read-mode cell: custom render or verbatim key.
                    if (col.render) {
                      return <td key={cellKey}>{col.render(row)}</td>;
                    }
                    const raw = readCell(row, col.key);
                    const text =
                      raw === null || raw === undefined ? '' : String(raw);
                    return <td key={cellKey}>{text}</td>;
                  })}

                  <td className="data-table-actions">
                    {isEditing ? (
                      <>
                        <PillButton
                          variant="primary"
                          onClick={() => commitEdit(row)}
                          disabled={isSaving}
                        >
                          저장
                        </PillButton>
                        <PillButton
                          variant="secondary"
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          취소
                        </PillButton>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="data-table-icon-button"
                          aria-label="편집"
                          title="편집"
                          onClick={() => beginEdit(row)}
                          disabled={
                            editingId !== null && editingId !== row.Wed_id
                          }
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="data-table-icon-button"
                          aria-label="삭제"
                          title="삭제"
                          onClick={() => requestDelete(row)}
                          disabled={editingId !== null}
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {pendingDeleteId !== null ? (
        <div
          className="confirm-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="삭제 확인"
        >
          <div className="confirm-dialog-card">
            <p className="confirm-dialog-message">정말 삭제하시겠습니까?</p>
            <div className="confirm-dialog-actions">
              <PillButton
                variant="primary"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                확인
              </PillButton>
              <PillButton
                variant="secondary"
                onClick={cancelDelete}
                disabled={isDeleting}
              >
                취소
              </PillButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
