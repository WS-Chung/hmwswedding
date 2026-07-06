import { useCallback, useEffect, useState } from 'react';
import { PageShell } from '../../components/PageShell';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';
import { DataTable } from '../../components/DataTable';
import type { DataTableColumn } from '../../components/DataTable';
import { ExternalLink } from '../../components/ExternalLink';
import { TextField } from '../../components/TextField';
import { Select } from '../../components/Select';
import { Modal } from '../../components/Modal';
import {
  normalizeDecision,
  DECISION_ITEM_MAX,
  DECISION_COMMENT_MAX,
} from '../../lib/normalize';
import { decisionApi } from './decisionApi';
import type { DecisionRecord } from './decisionApi';

/** 추가지출 드롭다운 옵션. */
const EXPENSE_OPTIONS = ['있음', '없음'] as const;

/**
 * DecisionPage (task 11.2)
 *
 * 결정사항 CRUD 페이지. 추가 액션은 팝업 모달(<Modal>) 안에서 처리된다.
 *
 * 컬럼: 항목 · 관계자 · 추가지출 · 관련링크 · 코멘트
 *  - 항목: 띄어쓰기 포함 최대 10자.
 *  - 추가지출: '있음' | '없음' 드롭다운 (null → 빈 칸).
 *  - 관련링크: 값이 있으면 <ExternalLink>로 감싸되 표시 텍스트는 "링크"만.
 *  - 코멘트: 여러 줄 입력(줄바꿈 보존), 최대 200자. 표에서도 줄바꿈 그대로 표시.
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

const NULLABLE_STRING_KEYS = [
  'Wed_stakeholder',
  'Wed_expense',
  'Wed_link',
  'Wed_comment',
] as const;

function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return '요청을 처리할 수 없습니다.';
}

function normalizeEditPatch(patch: Partial<DecisionRecord>): Partial<DecisionRecord> {
  const normalized: Partial<DecisionRecord> = { ...patch };

  // 빈/공백 문자열 → null (선택 컬럼).
  for (const key of NULLABLE_STRING_KEYS) {
    if (key in normalized) {
      const v = normalized[key];
      if (typeof v === 'string' && v.trim() === '') {
        normalized[key] = null;
      }
    }
  }

  // 항목: 필수 + 최대 10자.
  if ('Wed_item' in normalized) {
    const v = normalized.Wed_item;
    if (typeof v === 'string') {
      if (v.trim() === '') throw new Error('항목을 입력해주세요');
      if (v.length > DECISION_ITEM_MAX)
        throw new Error(`항목은 ${DECISION_ITEM_MAX}자 이내로 입력해주세요`);
    }
  }

  // 코멘트: 최대 200자.
  if ('Wed_comment' in normalized) {
    const v = normalized.Wed_comment;
    if (typeof v === 'string' && v.length > DECISION_COMMENT_MAX) {
      throw new Error(`코멘트는 ${DECISION_COMMENT_MAX}자 이내로 입력해주세요`);
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
    {
      key: 'Wed_item',
      header: '항목',
      width: '110px',
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_item' in patch ? ((patch.Wed_item as string) ?? '') : row.Wed_item;
        return (
          <input
            className="field-input data-table-edit-input"
            aria-label="항목"
            maxLength={DECISION_ITEM_MAX}
            value={current}
            onChange={(e) =>
              setPatch({ ...patch, Wed_item: e.target.value } as Partial<DecisionRecord>)
            }
          />
        );
      },
    },
    { key: 'Wed_stakeholder', header: '관계자', width: '90px' },
    {
      key: 'Wed_expense',
      header: '추가지출',
      width: '84px',
      render: (row) => (row.Wed_expense === null ? '' : row.Wed_expense),
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_expense' in patch
            ? ((patch.Wed_expense as string | null) ?? '')
            : (row.Wed_expense ?? '');
        return (
          <select
            className="field-input data-table-edit-input"
            aria-label="추가지출"
            value={current}
            onChange={(e) =>
              setPatch({
                ...patch,
                Wed_expense: e.target.value === '' ? null : e.target.value,
              } as Partial<DecisionRecord>)
            }
          >
            <option value="">-</option>
            {EXPENSE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'Wed_link',
      header: '관련링크',
      width: '80px',
      render: (row) =>
        row.Wed_link ? <ExternalLink href={row.Wed_link}>링크</ExternalLink> : '',
    },
    {
      key: 'Wed_comment',
      header: '코멘트',
      width: '400px',
      render: (row) =>
        row.Wed_comment ? (
          <div className="cell-multiline">{row.Wed_comment}</div>
        ) : (
          ''
        ),
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_comment' in patch
            ? ((patch.Wed_comment as string | null) ?? '')
            : (row.Wed_comment ?? '');
        return (
          <textarea
            className="field-input"
            aria-label="코멘트"
            maxLength={DECISION_COMMENT_MAX}
            rows={3}
            value={current}
            onChange={(e) =>
              setPatch({ ...patch, Wed_comment: e.target.value } as Partial<DecisionRecord>)
            }
          />
        );
      },
    },
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
              maxLength={DECISION_ITEM_MAX}
              value={newRow.Wed_item}
              onChange={(v) => setNewRow({ ...newRow, Wed_item: v })}
            />
            <TextField
              label="관계자"
              value={newRow.Wed_stakeholder}
              onChange={(v) => setNewRow({ ...newRow, Wed_stakeholder: v })}
            />
            <Select
              label="추가지출"
              value={newRow.Wed_expense}
              onChange={(v) => setNewRow({ ...newRow, Wed_expense: v })}
              options={EXPENSE_OPTIONS}
              placeholder="선택"
            />
            <TextField
              label="관련링크"
              value={newRow.Wed_link}
              onChange={(v) => setNewRow({ ...newRow, Wed_link: v })}
            />
            <TextField
              label="코멘트"
              multiline
              rows={4}
              maxLength={DECISION_COMMENT_MAX}
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
