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
import { normalizeTravel } from '../../lib/normalize';
import { travelApi } from './travelApi';
import type { TravelRecord } from './travelApi';

/**
 * TravelPage (여행준비)
 *
 * 여행 준비 항목 CRUD 페이지. 컬럼: 항목 · 금액 · 링크 · 비고.
 *  - 금액: 세 자리마다 콤마 표시(`formatKRW`), 입력은 스핀 없는 NumberField.
 *  - 링크: 값이 있으면 <ExternalLink>로 감싸되 표시 텍스트는 "링크"만.
 *  - 비고: 결정사항 코멘트처럼 넓은 폭 + 여러 줄(줄바꿈 보존).
 *  - 수정/삭제 버튼은 공용 DataTable이 우측에 렌더한다.
 *  - PC/모바일 반응형(모바일 카드형)도 DataTable/PageShell이 공통 처리한다.
 */

type NewRow = {
  Wed_item: string;
  Wed_amount: string;
  Wed_link: string;
  Wed_note: string;
};

const emptyNewRow: NewRow = {
  Wed_item: '',
  Wed_amount: '',
  Wed_link: '',
  Wed_note: '',
};

const NULLABLE_STRING_KEYS = ['Wed_link', 'Wed_note'] as const;

function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return '요청을 처리할 수 없습니다.';
}

/** 인라인 편집 patch 정규화: 빈 값 → null, 금액 정수 검증, 항목 필수. */
function normalizeEditPatch(patch: Partial<TravelRecord>): Partial<TravelRecord> {
  const normalized: Partial<TravelRecord> = { ...patch };

  for (const key of NULLABLE_STRING_KEYS) {
    if (key in normalized) {
      const v = normalized[key];
      if (typeof v === 'string' && v.trim() === '') {
        normalized[key] = null;
      }
    }
  }

  if ('Wed_item' in normalized) {
    const v = normalized.Wed_item;
    if (typeof v === 'string' && v.trim() === '') {
      throw new Error('항목을 입력해주세요');
    }
  }

  if ('Wed_amount' in normalized) {
    const v = normalized.Wed_amount as unknown;
    if (v === null || v === undefined || v === '') {
      normalized.Wed_amount = null;
    } else {
      const parsed = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 0) {
        throw new Error('금액은 0 이상의 정수여야 합니다');
      }
      normalized.Wed_amount = parsed;
    }
  }

  return normalized;
}

export function TravelPage() {
  const [records, setRecords] = useState<TravelRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<NewRow | null>(null);
  const [addErrors, setAddErrors] = useState<string[]>([]);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const rows = await travelApi.list();
      setRecords(rows);
    } catch (err) {
      setErrorMsg(extractMessage(err));
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const handleSave = useCallback(
    async (id: string, patch: Partial<TravelRecord>): Promise<void> => {
      setErrorMsg(null);
      const normalized = normalizeEditPatch(patch);
      await travelApi.update(id, normalized);
      await refetch();
    },
    [refetch],
  );

  const handleDelete = useCallback(
    async (id: string): Promise<void> => {
      setErrorMsg(null);
      await travelApi.remove(id);
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
    const result = normalizeTravel(newRow);
    if (!result.ok) {
      setAddErrors(result.errors);
      return;
    }
    setAddErrors([]);
    setIsSubmittingAdd(true);
    try {
      await travelApi.create(result.value);
      await refetch();
      setNewRow(null);
    } catch (err) {
      setAddErrors([extractMessage(err)]);
    } finally {
      setIsSubmittingAdd(false);
    }
  }, [newRow, isSubmittingAdd, refetch]);

  const columns: DataTableColumn<TravelRecord>[] = [
    { key: 'Wed_item', header: '항목', width: '140px' },
    {
      key: 'Wed_amount',
      header: '금액',
      width: '100px',
      render: (row) => (row.Wed_amount === null ? '' : formatKRW(row.Wed_amount)),
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_amount' in patch
            ? ((patch.Wed_amount as unknown as number | null) ?? null)
            : row.Wed_amount;
        return (
          <NumberField
            label="금액"
            hideLabel
            value={current}
            onChange={(v) =>
              setPatch({ ...patch, Wed_amount: v } as Partial<TravelRecord>)
            }
          />
        );
      },
    },
    {
      key: 'Wed_link',
      header: '링크',
      width: '70px',
      render: (row) =>
        row.Wed_link ? <ExternalLink href={row.Wed_link}>링크</ExternalLink> : '',
    },
    {
      key: 'Wed_note',
      header: '비고',
      width: '400px',
      render: (row) =>
        row.Wed_note ? (
          <div className="cell-multiline">{row.Wed_note}</div>
        ) : (
          ''
        ),
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_note' in patch
            ? ((patch.Wed_note as string | null) ?? '')
            : (row.Wed_note ?? '');
        return (
          <textarea
            className="field-input"
            aria-label="비고"
            rows={3}
            value={current}
            onChange={(e) =>
              setPatch({ ...patch, Wed_note: e.target.value } as Partial<TravelRecord>)
            }
          />
        );
      },
    },
  ];

  return (
    <PageShell
      title="여행준비"
      toolbar={<PillButton onClick={handleAdd}>추가</PillButton>}
    >
      {errorMsg && <InlineError>{errorMsg}</InlineError>}

      <DataTable<TravelRecord>
        rows={records}
        columns={columns}
        onSaveEdit={handleSave}
        onDelete={handleDelete}
        onError={setErrorMsg}
        emptyMessage="등록된 여행 준비 항목이 없습니다"
      />

      <Modal
        isOpen={newRow !== null}
        onClose={handleAddCancel}
        title="새 여행 준비"
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
            <NumberField
              label="금액"
              value={newRow.Wed_amount === '' ? null : Number(newRow.Wed_amount)}
              onChange={(v) =>
                setNewRow({
                  ...newRow,
                  Wed_amount: v === null ? '' : String(v),
                })
              }
            />
            <TextField
              label="링크"
              value={newRow.Wed_link}
              onChange={(v) => setNewRow({ ...newRow, Wed_link: v })}
            />
            <TextField
              label="비고"
              multiline
              rows={4}
              value={newRow.Wed_note}
              onChange={(v) => setNewRow({ ...newRow, Wed_note: v })}
            />
            {addErrors.length > 0 && <InlineError>{addErrors.join(' · ')}</InlineError>}
          </>
        )}
      </Modal>
    </PageShell>
  );
}
