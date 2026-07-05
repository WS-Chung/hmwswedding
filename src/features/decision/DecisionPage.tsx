import { useCallback, useEffect, useState } from 'react';
import { PageShell } from '../../components/PageShell';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';
import { DataTable } from '../../components/DataTable';
import type { DataTableColumn } from '../../components/DataTable';
import { ExternalLink } from '../../components/ExternalLink';
import { TextField } from '../../components/TextField';
import { NumberField } from '../../components/NumberField';
import { Modal } from '../../components/Modal';
import { formatKRW } from '../../lib/format';
import { normalizeDecision } from '../../lib/normalize';
import { decisionApi } from './decisionApi';
import type { DecisionRecord } from './decisionApi';

/**
 * DecisionPage (task 11.2)
 *
 * 결정사항 CRUD 페이지. 추가 액션은 팝업 모달(<Modal>) 안에서 처리된다.
 *
 * 컬럼: 항목 · 관계자 · 지출 · 관련링크 · 코멘트
 *  - 지출: null → '-', otherwise formatKRW
 *  - 관련링크: 비어있으면 plain text, 값이 있으면 <ExternalLink>
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

const NULLABLE_STRING_KEYS = ['Wed_stakeholder', 'Wed_link', 'Wed_comment'] as const;

function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return '요청을 처리할 수 없습니다.';
}

function normalizeEditPatch(patch: Partial<DecisionRecord>): Partial<DecisionRecord> {
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
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
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
      setAddErrors([extractMessage(err)]);
    } finally {
      setIsSubmittingAdd(false);
    }
  }, [newRow, isSubmittingAdd, refetch]);

  const columns: DataTableColumn<DecisionRecord>[] = [
    { key: 'Wed_item', header: '항목' },
    { key: 'Wed_stakeholder', header: '관계자' },
    {
      key: 'Wed_expense',
      header: '지출',
      render: (row) => (row.Wed_expense === null ? '-' : formatKRW(row.Wed_expense)),
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_expense' in patch
            ? ((patch.Wed_expense as unknown as number | null) ?? null)
            : row.Wed_expense;
        return (
          <NumberField
            label="지출"
            hideLabel
            value={current}
            onChange={(v) =>
              setPatch({ ...patch, Wed_expense: v } as Partial<DecisionRecord>)
            }
          />
        );
      },
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

      <Modal
        isOpen={newRow !== null}
        onClose={handleAddCancel}
        title="새 결정사항"
        actions={
          <>
            <PillButton
              variant="secondary"
              onClick={handleAddCancel}
              disabled={isSubmittingAdd}
            >
              취소
            </PillButton>
            <PillButton
              variant="primary"
              onClick={handleAddSubmit}
              disabled={isSubmittingAdd}
            >
              저장
            </PillButton>
          </>
        }
      >
        {newRow && (
          <>
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
            {addErrors.length > 0 && <InlineError>{addErrors.join(' · ')}</InlineError>}
          </>
        )}
      </Modal>
    </PageShell>
  );
}
