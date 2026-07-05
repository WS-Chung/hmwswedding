import { useCallback, useEffect, useState } from 'react';
import { PageShell } from '../../components/PageShell';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';
import { DataTable } from '../../components/DataTable';
import type { DataTableColumn } from '../../components/DataTable';
import { ExternalLink } from '../../components/ExternalLink';
import { TextField } from '../../components/TextField';
import { NumberField } from '../../components/NumberField';
import { formatKRW } from '../../lib/format';
import { normalizeDecision } from '../../lib/normalize';
import { decisionApi } from './decisionApi';
import type { DecisionRecord } from './decisionApi';

/**
 * DecisionPage (task 11.2)
 *
 * Renders the 결정사항 CRUD grid over `Wed_Decision`:
 *   - 항목 · 관계자 · 지출 · 관련링크 · 코멘트 columns (design.md §
 *     Decision_Manager, Requirement 3.1–3.5)
 *   - Link cell renders `<ExternalLink>` when `Wed_link` is a non-empty
 *     string; empty / null renders as plain text with no anchor
 *     (Requirement 3.7 / design § Decision_Manager 렌더링 규칙).
 *   - 지출 cell shows "-" for null and comma-separated KRW otherwise
 *     (Requirement 3.6 · null 저장; 3.5 · 원 단위 정수 표시).
 *
 * Add flow:
 *   Clicking the toolbar 추가 button surfaces an inline 5-field form
 *   (항목 / 관계자 / 지출 / 관련링크 / 코멘트) below the table with 저장/취소
 *   controls. Save routes the raw string form through `normalizeDecision`
 *   (Requirement 3.6, Property 14) before calling `decisionApi.create`.
 *
 * State ownership:
 *   - `records`      – current list from `decisionApi.list()`, refetched
 *                      after every successful mutation.
 *   - `errorMsg`     – page-level banner text; cleared on any new attempt,
 *                      set by `<DataTable onError>` when inline
 *                      edit/delete rejects (design § 에러 처리 원칙).
 *   - `newRow`       – null hides the add form; non-null renders it with
 *                      the current raw string values.
 *   - `addErrors`    – user-facing normalize errors surfaced under the
 *                      add form only (do not overwrite page banner).
 *
 * Requirements covered: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7.
 */

/**
 * Raw string form state for the "새 결정사항" inline add form.
 *
 * Every field is stored as a `string` here (even numeric 지출) so it can
 * be fed directly to `normalizeDecision`, which encapsulates parsing and
 * validation. Empty strings ("") represent absent optional values.
 */
type NewRow = {
  Wed_item: string;
  Wed_stakeholder: string;
  Wed_expense: string;
  Wed_link: string;
  Wed_comment: string;
};

const emptyNewRow: NewRow = {
  Wed_item: '',
  Wed_stakeholder: '',
  Wed_expense: '',
  Wed_link: '',
  Wed_comment: '',
};

/** Nullable string columns used by the inline-edit patch normalizer below. */
const NULLABLE_STRING_KEYS = [
  'Wed_stakeholder',
  'Wed_link',
  'Wed_comment',
] as const;

/**
 * Best-effort user-facing message extraction from an unknown thrown value.
 * Mirrors DataTable's helper so we do not leak `[object Object]` into the
 * error banner.
 */
function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return '요청을 처리할 수 없습니다.';
}

/**
 * Normalize a `<DataTable>` inline-edit patch into a shape acceptable to
 * `decisionApi.update`:
 *   - Empty / whitespace-only strings on nullable string columns → `null`.
 *   - `Wed_expense`: empty → `null`; otherwise parsed to a non-negative
 *     integer. A non-parseable value throws so the row stays in edit mode
 *     and `<DataTable>` routes the message to our onError handler
 *     (Requirement 3.5 · 원 단위 정수).
 */
function normalizeEditPatch(
  patch: Partial<DecisionRecord>,
): Partial<DecisionRecord> {
  const normalized: Partial<DecisionRecord> = { ...patch };

  for (const key of NULLABLE_STRING_KEYS) {
    if (key in normalized) {
      const v = normalized[key];
      if (typeof v === 'string' && v.trim() === '') {
        normalized[key] = null;
      }
    }
  }

  if ('Wed_expense' in normalized) {
    const v = normalized.Wed_expense as unknown;
    if (v === null || v === undefined || v === '') {
      normalized.Wed_expense = null;
    } else if (typeof v === 'number') {
      if (!Number.isInteger(v) || v < 0 || !Number.isFinite(v)) {
        throw new Error('지출은 0 이상의 정수여야 합니다');
      }
      normalized.Wed_expense = v;
    } else if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed === '') {
        normalized.Wed_expense = null;
      } else {
        const parsed = Number(trimmed);
        if (
          !Number.isFinite(parsed) ||
          !Number.isInteger(parsed) ||
          parsed < 0
        ) {
          throw new Error('지출은 0 이상의 정수여야 합니다');
        }
        normalized.Wed_expense = parsed;
      }
    }
  }

  return normalized;
}

export function DecisionPage() {
  const [records, setRecords] = useState<DecisionRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<NewRow | null>(null);
  const [addErrors, setAddErrors] = useState<string[]>([]);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  /**
   * refetch: pull the authoritative list from Supabase. Any error is
   * surfaced through the page banner without touching the previous
   * `records` value (Requirement 2.12 pattern applied to Decision_Manager
   * per design § 에러 처리 원칙 / Property 17).
   */
  const refetch = useCallback(async () => {
    try {
      const rows = await decisionApi.list();
      setRecords(rows);
    } catch (err) {
      setErrorMsg(extractMessage(err));
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /**
   * Inline-edit save. Re-throws on failure so `<DataTable>` keeps the row
   * in edit mode and routes the message into `setErrorMsg` via `onError`.
   */
  const handleSave = useCallback(
    async (id: string, patch: Partial<DecisionRecord>): Promise<void> => {
      setErrorMsg(null);
      const normalized = normalizeEditPatch(patch);
      await decisionApi.update(id, normalized);
      await refetch();
    },
    [refetch],
  );

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      setErrorMsg(null);
      await decisionApi.remove(id);
      await refetch();
    },
    [refetch],
  );

  const handleAdd = useCallback(() => {
    setErrorMsg(null);
    setAddErrors([]);
    setNewRow({ ...emptyNewRow });
  }, []);

  const handleAddCancel = useCallback(() => {
    if (isSubmittingAdd) return;
    setNewRow(null);
    setAddErrors([]);
  }, [isSubmittingAdd]);

  const handleAddSubmit = useCallback(async () => {
    if (!newRow || isSubmittingAdd) return;
    const result = normalizeDecision(newRow);
    if (!result.ok) {
      setAddErrors(result.errors);
      return;
    }
    setAddErrors([]);
    setIsSubmittingAdd(true);
    try {
      await decisionApi.create(result.value);
      await refetch();
      setNewRow(null);
    } catch (err) {
      setErrorMsg(extractMessage(err));
    } finally {
      setIsSubmittingAdd(false);
    }
  }, [newRow, isSubmittingAdd, refetch]);

  /**
   * Column configuration for the grid. Custom renderers only where the
   * task-spec calls for domain-specific formatting:
   *  - 지출: `null` → "-", otherwise `formatKRW`  (Requirement 3.6 / 3.5)
   *  - 관련링크: `null`/"" → plain text (no anchor); otherwise
   *              `<ExternalLink>` (Requirement 3.7)
   *
   * Other columns rely on `<DataTable>`'s default renderer which
   * transparently maps `null` → "" for read mode and edit mode.
   */
  const columns: DataTableColumn<DecisionRecord>[] = [
    { key: 'Wed_item', header: '항목' },
    { key: 'Wed_stakeholder', header: '관계자' },
    {
      key: 'Wed_expense',
      header: '지출',
      render: (row) =>
        row.Wed_expense === null ? '-' : formatKRW(row.Wed_expense),
    },
    {
      key: 'Wed_link',
      header: '관련링크',
      render: (row) =>
        row.Wed_link ? (
          <ExternalLink href={row.Wed_link}>{row.Wed_link}</ExternalLink>
        ) : (
          ''
        ),
    },
    { key: 'Wed_comment', header: '코멘트' },
  ];

  return (
    <PageShell
      title="결정사항"
      toolbar={<PillButton onClick={handleAdd}>추가</PillButton>}
    >
      {errorMsg && <InlineError>{errorMsg}</InlineError>}

      <DataTable<DecisionRecord>
        rows={records}
        columns={columns}
        onSaveEdit={handleSave}
        onDelete={handleDelete}
        onError={setErrorMsg}
        emptyMessage="등록된 결정사항이 없습니다"
      />

      {newRow !== null && (
        <section
          className="decision-add-form"
          aria-label="새 결정사항"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-sm)',
            padding: 'var(--space-lg)',
            background: 'var(--surface-pearl)',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--rounded-md)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--font-body-strong-size)',
              fontWeight: 'var(--font-body-strong-weight)',
              lineHeight: 'var(--font-body-strong-line-height)',
              color: 'var(--ink)',
            }}
          >
            새 결정사항
          </h2>
          <TextField
            label="항목"
            required
            value={newRow.Wed_item}
            onChange={(v) => setNewRow({ ...newRow, Wed_item: v })}
          />
          <TextField
            label="관계자"
            value={newRow.Wed_stakeholder}
            onChange={(v) => setNewRow({ ...newRow, Wed_stakeholder: v })}
          />
          <NumberField
            label="지출"
            value={newRow.Wed_expense === '' ? null : Number(newRow.Wed_expense)}
            onChange={(v) =>
              setNewRow({
                ...newRow,
                Wed_expense: v === null ? '' : String(v),
              })
            }
          />
          <TextField
            label="관련링크"
            value={newRow.Wed_link}
            onChange={(v) => setNewRow({ ...newRow, Wed_link: v })}
          />
          <TextField
            label="코멘트"
            value={newRow.Wed_comment}
            onChange={(v) => setNewRow({ ...newRow, Wed_comment: v })}
          />
          {addErrors.length > 0 && (
            <InlineError>{addErrors.join(' · ')}</InlineError>
          )}
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-sm)',
              justifyContent: 'flex-end',
            }}
          >
            <PillButton
              variant="primary"
              onClick={handleAddSubmit}
              disabled={isSubmittingAdd}
            >
              저장
            </PillButton>
            <PillButton
              variant="secondary"
              onClick={handleAddCancel}
              disabled={isSubmittingAdd}
            >
              취소
            </PillButton>
          </div>
        </section>
      )}
    </PageShell>
  );
}
