import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BAGS, bagTitle } from './bags';
import type { BagDefinition, BagKey } from './bags';

/**
 * TravelPage (여행준비)
 *
 * 페이지는 수하물을 형상화한 4개의 카드로 구성된다.
 *   [혜민 캐리어(큰 카드 · 70%)] [혜민 기내가방(작은 카드 · 30%)]
 *   [운석 캐리어(큰 카드 · 70%)] [운석 기내가방(작은 카드 · 30%)]
 *
 * 각 카드는 자기 가방(`Wed_bag`)에 속한 항목만 담는 독립 테이블을 갖고,
 * 카드 헤더의 "추가" 버튼 → 카드 내부 인라인 편집(✏️) → 삭제(🗑️)로 카드 단위
 * CRUD가 완결된다. 컬럼은 항목 · 링크 · 수량 · 설명 4개이며, 그 왼쪽에 챙김
 * 체크박스 컬럼이 하나 더 붙는다.
 *
 * "수량" 컬럼의 저장 위치는 기존 `Wed_Travel.Wed_amount`다. 화면 라벨만 금액에서
 * 수량으로 바뀌었을 뿐이므로 DB 스키마 변경은 없다. 0 이상의 정수라는 검증
 * 규칙도 그대로 유효하다.
 *
 * 챙김 체크(취소선):
 *   물건을 가방에 넣으면서 눈으로 소거하기 위한 **화면 전용** 표시다. 서버에
 *   저장하지 않고 이 컴포넌트의 로컬 state(`packedIds`)로만 관리하므로
 *   새로고침하면 초기화된다. 체크된 행은 `row-packed` 클래스로 전체가 취소선 +
 *   뮤트 처리된다. 삭제된 행의 id가 set에 남아도 렌더에 영향이 없다.
 *
 * 데이터 흐름은 다른 페이지와 동일하다: 이 컴포넌트가 전체 레코드 목록을
 * 소유하고, mutation 성공 시에만 `refetch()`로 목록 전체를 교체한다. 실패 시
 * 로컬 state를 건드리지 않아 화면이 이전 상태를 유지한다.
 *
 * 시각 규격은 DA_WEBUI_KIT.md §7.8(Card) · §7.12(DataTable)를 따르며,
 * 카드의 손잡이·바퀴 데코와 그리드 비율은 global.css의 `.luggage-*` 규칙이
 * 담당한다. 작은 카드의 표는 컨테이너 쿼리로 "라벨: 값" 카드형으로 접힌다.
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

/** 인라인 편집 patch 정규화: 빈 값 → null, 수량 정수 검증, 항목 필수. */
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
        throw new Error('수량은 0 이상의 정수여야 합니다');
      }
      normalized.Wed_amount = parsed;
    }
  }

  return normalized;
}

export function TravelPage() {
  const [records, setRecords] = useState<TravelRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  /** 어떤 가방 카드의 "추가"가 열려 있는지. null이면 모달이 닫힌 상태. */
  const [addBag, setAddBag] = useState<BagKey | null>(null);
  const [newRow, setNewRow] = useState<NewRow>({ ...emptyNewRow });
  const [addErrors, setAddErrors] = useState<string[]>([]);
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);
  /**
   * 챙김 표시된 행의 `Wed_id` 집합. 화면 전용 상태이므로 서버로 나가지 않고
   * 새로고침 시 비워진다.
   */
  const [packedIds, setPackedIds] = useState<ReadonlySet<string>>(new Set());

  const refetch = useCallback(async () => {
    try {
      const rows = await travelApi.list();
      setRecords(rows);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(extractMessage(err));
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  /** 가방별로 레코드를 분배한다. 알 수 없는 `Wed_bag` 값은 표시되지 않는다. */
  const byBag = useMemo(() => {
    const groups = new Map<BagKey, TravelRecord[]>();
    for (const bag of BAGS) groups.set(bag.key, []);
    for (const row of records) {
      groups.get(row.Wed_bag)?.push(row);
    }
    return groups;
  }, [records]);

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

  /** 챙김 표시 토글 — 로컬 state만 바꾼다(서버 요청 없음). */
  const handleTogglePacked = useCallback((id: string) => {
    setPackedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleOpenAdd = useCallback((bag: BagKey) => {
    setErrorMsg(null);
    setAddErrors([]);
    setNewRow({ ...emptyNewRow });
    setAddBag(bag);
  }, []);

  const handleAddCancel = useCallback(() => {
    if (isSubmittingAdd) return;
    setAddBag(null);
    setAddErrors([]);
  }, [isSubmittingAdd]);

  const handleAddSubmit = useCallback(async () => {
    if (addBag === null || isSubmittingAdd) return;
    const result = normalizeTravel({ ...newRow, Wed_bag: addBag });
    if (!result.ok) {
      setAddErrors(result.errors);
      return;
    }
    setAddErrors([]);
    setIsSubmittingAdd(true);
    try {
      await travelApi.create({ ...result.value, Wed_bag: addBag });
      await refetch();
      setAddBag(null);
    } catch (err) {
      setAddErrors([extractMessage(err)]);
    } finally {
      setIsSubmittingAdd(false);
    }
  }, [addBag, newRow, isSubmittingAdd, refetch]);

  /**
   * 4개 카드가 공유하는 컬럼 정의: 항목 · 링크 · 금액 · 설명.
   *
   * 카드 4장이 2열로 나란히 놓이므로 한 카드에 주어지는 폭이 좁다. 실제 입력량이
   * 가장 적은 "설명"의 폭을 가장 크게 줄여 나머지 열이 뭉개지지 않게 했다.
   * 그래도 넘치면 카드 본문이 가로 스크롤된다.
   */
  const columns: DataTableColumn<TravelRecord>[] = [
    { key: 'Wed_item', header: '항목', width: '140px' },
    {
      key: 'Wed_link',
      header: '링크',
      width: '56px',
      render: (row) =>
        row.Wed_link ? <ExternalLink href={row.Wed_link}>링크</ExternalLink> : '',
    },
    {
      // 컬럼 라벨은 "수량"이지만 저장 컬럼은 기존 `Wed_amount`를 그대로 쓴다
      // (DB 변경 없음 — 값의 의미만 금액에서 수량으로 바뀐다).
      key: 'Wed_amount',
      header: '수량',
      width: '70px',
      render: (row) => (row.Wed_amount === null ? '' : formatKRW(row.Wed_amount)),
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_amount' in patch
            ? ((patch.Wed_amount as unknown as number | null) ?? null)
            : row.Wed_amount;
        return (
          <NumberField
            label="수량"
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
      key: 'Wed_note',
      header: '설명',
      width: '140px',
      render: (row) =>
        row.Wed_note ? <div className="cell-multiline">{row.Wed_note}</div> : '',
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_note' in patch
            ? ((patch.Wed_note as string | null) ?? '')
            : (row.Wed_note ?? '');
        return (
          <textarea
            className="field-input"
            aria-label="설명"
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

  /** 카드 한 장 — 헤더(번호·타이틀·건수·합계·챙김 진행) + 자기 테이블. */
  const renderCard = (bag: BagDefinition) => {
    const rows = byBag.get(bag.key) ?? [];
    const sum = rows.reduce((acc, r) => acc + (r.Wed_amount ?? 0), 0);
    const packedCount = rows.filter((r) => packedIds.has(r.Wed_id)).length;
    const allPacked = rows.length > 0 && packedCount === rows.length;

    return (
      <section
        key={bag.key}
        className={`luggage-card luggage-card--${bag.size}`}
        aria-label={bag.title}
      >
        <span className="luggage-handle" aria-hidden="true" />

        <header className="luggage-card__header">
          <span className="luggage-card__num" aria-hidden="true">
            {bag.number}
          </span>
          <h2 className="luggage-card__title">{bag.title}</h2>
          <span className="tag tag-navy">
            {rows.length}건 · 총 {formatKRW(sum)}개
          </span>
          {rows.length > 0 && (
            <span className={allPacked ? 'tag tag-done' : 'tag tag-muted'}>
              {allPacked ? '✓ ' : ''}
              {packedCount}/{rows.length} 챙김
            </span>
          )}
          <div className="luggage-card__spacer">
            <PillButton
              variant="secondary"
              onClick={() => handleOpenAdd(bag.key)}
              disabled={isSubmittingAdd}
            >
              추가
            </PillButton>
          </div>
        </header>

        <div className="luggage-card__body">
          <DataTable<TravelRecord>
            rows={rows}
            columns={columns}
            leadingControl={(row) => (
              <input
                type="checkbox"
                className="pack-checkbox"
                checked={packedIds.has(row.Wed_id)}
                onChange={() => handleTogglePacked(row.Wed_id)}
                aria-label={`${row.Wed_item} 챙김`}
              />
            )}
            leadingControlLabel="챙김"
            rowClassName={(row) =>
              packedIds.has(row.Wed_id) ? 'row-packed' : undefined
            }
            onSaveEdit={handleSave}
            onDelete={handleDelete}
            onError={setErrorMsg}
            emptyMessage="담은 항목이 없습니다"
          />
        </div>

        <span className="luggage-wheels" aria-hidden="true" />
      </section>
    );
  };

  return (
    <PageShell
      title="여행준비"
      number="04"
      eyebrow="Travel"
      description="캐리어와 기내가방에 담을 항목을 가방별로 나눠 관리합니다."
      className="page-wide"
    >
      {errorMsg && <InlineError>{errorMsg}</InlineError>}

      <div className="luggage-grid">{BAGS.map(renderCard)}</div>

      <Modal
        isOpen={addBag !== null}
        onClose={handleAddCancel}
        title={addBag ? `${bagTitle(addBag)} · 항목 추가` : '항목 추가'}
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
        <TextField
          label="항목"
          required
          value={newRow.Wed_item}
          onChange={(v) => setNewRow({ ...newRow, Wed_item: v })}
        />
        <TextField
          label="링크"
          value={newRow.Wed_link}
          onChange={(v) => setNewRow({ ...newRow, Wed_link: v })}
        />
        <NumberField
          label="수량"
          value={newRow.Wed_amount === '' ? null : Number(newRow.Wed_amount)}
          onChange={(v) =>
            setNewRow({
              ...newRow,
              Wed_amount: v === null ? '' : String(v),
            })
          }
        />
        <TextField
          label="설명"
          multiline
          rows={4}
          value={newRow.Wed_note}
          onChange={(v) => setNewRow({ ...newRow, Wed_note: v })}
        />
        {addErrors.length > 0 && <InlineError>{addErrors.join(' · ')}</InlineError>}
      </Modal>
    </PageShell>
  );
}
