import { useState } from 'react';
import { PillButton } from '../../components/PillButton';
import { Select } from '../../components/Select';
import { TextField } from '../../components/TextField';
import { NumberField } from '../../components/NumberField';
import { DateField } from '../../components/DateField';
import { DataTable } from '../../components/DataTable';
import type { DataTableColumn } from '../../components/DataTable';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { groupByCategory } from '../../lib/budget';
import { normalizeBudgetItem } from '../../lib/normalize';
import { formatKRW } from '../../lib/format';
import { isValidAmount } from '../../lib/validators';
import { budgetApi } from './budgetApi';
import type { BudgetItem, BudgetItemUpdatePatch } from './budgetApi';

/**
 * BudgetItemTable (task 14.3)
 *
 * Budget_Manager의 카테고리 그룹형 CRUD 그리드. 예산관리 페이지에서
 * `BudgetSummary` 아래에 배치되며, 상위(`BudgetPage`)로부터 다음을 위임받는다.
 *
 *   - `items`      : `Wed_Budget_Item` 전체 목록.
 *   - `categories` : `Wed_Budget_Category`의 이름 리스트(마스터). Select
 *                    옵션의 authoritative 집합이 된다(Requirement 5.6, 6.8).
 *   - `onMutate`   : create/update/delete 성공 후 상위가 재조회를 트리거하기
 *                    위한 콜백. 인자 없음.
 *   - `onError`    : 표준화된 5종 사용자 메시지를 상위 페이지 배너로 라우팅.
 *
 * 렌더링 구조(design.md § BudgetItemTable):
 *
 *   1) `groupByCategory(items)`로 카테고리별 그룹핑(Property 13, Requirement 5.1).
 *   2) `categories` 순서대로 각 카테고리에 대해 <section>을 렌더한다:
 *        - <h3>{카테고리명}</h3>
 *        - 우측 정렬 "항목 추가" PillButton
 *        - `<DataTable>`에 그 그룹의 항목을 표시(카테고리 열은 포함하지 않음 —
 *          섹션 헤더가 이미 카테고리를 시각적으로 담당). 열 순서:
 *          항목명 · 결제자 · 결제금액 · 결제일 · 결제수단 · 거래처 · 비고.
 *        - 결제금액 열은 `formatKRW`로 표시(Requirement 7.7 스타일).
 *   3) 마스터 목록(`categories`)에 존재하지 않는 카테고리를 가진 스트랜디드
 *      항목이 있으면 "기타(미분류)" 섹션 대신 원본 카테고리명 그대로 각각의
 *      섹션으로 렌더한다(참조 무결성이 깨진 히스토리컬 데이터 방어).
 *
 * 인라인 추가 폼(카테고리 필드 필수 — Requirement 5.7):
 *   - `newRowCategory` state가 non-null일 때 아래에 표시된다. 초기 카테고리
 *     값은 사용자가 클릭한 섹션의 카테고리로 pre-fill 된다.
 *   - 저장 게이트는 `normalizeBudgetItem`이 담당한다:
 *       · `Wed_category` 필수 (Requirement 5.7)
 *       · `Wed_amount` 필수 + `isValidAmount`(0 이상 정수, Requirement 5.9)
 *       · 그 외 8개 필드는 빈 문자열 → null 정규화(Requirement 5.8, Property 14)
 *   - 정규화 실패 시 첫 번째 오류 메시지를 폼 하단 `<InlineError>`로 노출하고
 *     서버 요청은 발생하지 않는다.
 *
 * 인라인 행 편집(카테고리 컬럼 없음):
 *   - 카테고리 변경은 이 표에서 지원하지 않는다(섹션 헤더가 카테고리를
 *     소유하므로, 실질적 이동은 "삭제 + 재생성"으로만 가능). 따라서
 *     사용자는 다른 8개 컬럼만 인라인 편집한다.
 *   - Save gate(design.md § BudgetItemTable · 저장 게이트):
 *       · `Wed_amount`가 patch에 있으면 `isValidAmount` 재검증. 빈 값 또는
 *         non-integer / 음수 / non-finite면 저장을 거부(throw). DataTable이
 *         편집 모드를 유지하고 `onError`로 메시지를 라우팅한다.
 *       · 다른 nullable string 컬럼(항목명 · 상품명 · 결제일 등)에
 *         공백/빈 값이 들어오면 `null`로 정규화(Requirement 5.8).
 *
 * 오류 처리 계약(Requirement 2.5, Property 17):
 *   - 이 컴포넌트는 상위 `items` state를 절대 직접 수정하지 않는다.
 *   - 어떤 mutation이 실패해도 로컬 UI는 이전 상태를 그대로 유지하며
 *     `onError`(있으면)로 표준화된 메시지를 상위에 통보한다.
 *   - 성공 후에만 `onMutate()`를 호출해 상위 재조회로 이어지고, 그 결과
 *     새로운 `items`가 이 컴포넌트에 재-props 되어 재렌더된다.
 *
 * Validates: Requirements 5.1, 5.5, 5.6, 5.7, 5.8, 5.9
 */

/** 상위(부모)로부터 받는 props 시그니처. */
export interface BudgetItemTableProps {
  /** `Wed_Budget_Item` 전체 목록. 순서는 상위가 결정(보통 created_at ASC). */
  items: BudgetItem[];
  /** `Wed_Budget_Category` 이름 리스트(마스터). Select 옵션의 authoritative 집합. */
  categories: string[];
  /** create/update/delete 성공 후 상위가 재조회를 트리거하기 위한 콜백. */
  onMutate: () => Promise<void> | void;
  /** 표준화된 오류 메시지를 상위 페이지 배너로 라우팅하는 선택 훅. */
  onError?: (msg: string) => void;
}

/**
 * 인라인 추가 폼이 다루는 9개 필드의 raw string state.
 *
 * 모든 필드가 `string`으로 저장되기 때문에 폼 위젯의 controlled value와
 * `normalizeBudgetItem`의 입력을 그대로 연결할 수 있다. 정규화 함수가
 * 빈 문자열 → null, 숫자 파싱, 필수 필드 검증을 담당한다(Property 14).
 */
type AddFormState = {
  Wed_category: string;
  Wed_item_name: string;
  Wed_payer: string;
  Wed_amount: string;
  Wed_due_date: string;
  Wed_pay_method: string;
  Wed_vendor: string;
  Wed_note: string;
};

/** 결제자 드롭다운 옵션(고정 2인). */
const PAYER_OPTIONS = ['혜민', '운석'] as const;

/** 빈 폼 초기값. `Wed_category`는 `newRowCategory`가 open 시 별도로 채운다. */
function emptyAddForm(category: string): AddFormState {
  return {
    Wed_category: category,
    Wed_item_name: '',
    Wed_payer: '',
    Wed_amount: '',
    Wed_due_date: '',
    Wed_pay_method: '',
    Wed_vendor: '',
    Wed_note: '',
  };
}

/**
 * `unknown` 예외로부터 사용자 문구를 추출한다. `mapSupabaseError`가 이미
 * `throw new Error(<표준 5종 중 하나>)` 형태로 감싸서 재던지므로 대부분의
 * 경우 `err.message`가 그대로 표준 메시지다.
 */
function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return '요청을 처리할 수 없습니다.';
}

/** 인라인 편집에서 nullable string으로 사상되는 컬럼 이름 목록. */
const NULLABLE_STRING_KEYS = [
  'Wed_item_name',
  'Wed_payer',
  'Wed_due_date',
  'Wed_pay_method',
  'Wed_vendor',
  'Wed_note',
] as const;

/**
 * `<DataTable>`이 넘긴 인라인-편집 patch를 `budgetApi.update`에 적합한 형태로
 * 정규화한다. 실패 조건은 throw로 표현되며, DataTable이 편집 모드를 유지한
 * 채 `onError`에 메시지를 라우팅하도록 한다.
 *
 *   - `Wed_amount`가 patch에 있으면 정수 + `>= 0` 검증(Requirement 5.9,
 *     Property 4). 빈 문자열, non-finite, non-integer, 음수 모두 거부.
 *   - `NULLABLE_STRING_KEYS`에 속한 컬럼이 빈/공백 문자열이면 `null`로 사상
 *     (Requirement 5.8, Property 14 (a)).
 *   - `Wed_category`는 이 표의 편집 모드에서는 노출되지 않지만, 방어적으로
 *     patch에 들어와도 그대로 통과시킨다(카테고리 정책은 상위에서 별도 관리).
 */
function normalizeEditPatch(
  patch: Partial<BudgetItem>,
): BudgetItemUpdatePatch {
  const normalized: BudgetItemUpdatePatch = {};

  // 결제금액: patch에 있으면 정수 + non-negative 강제.
  if ('Wed_amount' in patch) {
    const raw = (patch as Record<string, unknown>).Wed_amount;
    if (raw === null || raw === undefined || raw === '') {
      throw new Error('결제금액을 입력해주세요');
    }
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    if (!isValidAmount(parsed)) {
      throw new Error('결제금액은 0 이상의 정수여야 합니다');
    }
    normalized.Wed_amount = parsed;
  }

  // Nullable string 컬럼: 빈/공백 → null, 그 외 원문 유지.
  for (const key of NULLABLE_STRING_KEYS) {
    if (key in patch) {
      const v = (patch as Record<string, unknown>)[key];
      if (v === null || v === undefined) {
        normalized[key] = null;
      } else if (typeof v === 'string') {
        normalized[key] = v.trim() === '' ? null : v;
      }
    }
  }

  // 카테고리: 방어적 통과(현재 UI에서는 표에서 편집 불가하므로 존재하지 않음).
  if ('Wed_category' in patch) {
    const v = (patch as Record<string, unknown>).Wed_category;
    if (typeof v === 'string' && v.trim().length > 0) {
      normalized.Wed_category = v;
    }
  }

  return normalized;
}

/**
 * `groupByCategory` 결과에서 카테고리 마스터 목록에 존재하지 않는 카테고리
 * (stranded)만 추린 이름 배열을 반환한다. 배열 순서는 입력 items에서 처음
 * 등장한 순서를 유지한다.
 */
function findStrandedCategories(
  items: BudgetItem[],
  masterCategories: string[],
): string[] {
  const master = new Set(masterCategories);
  const seen = new Set<string>();
  const stranded: string[] = [];
  for (const it of items) {
    if (!master.has(it.Wed_category) && !seen.has(it.Wed_category)) {
      seen.add(it.Wed_category);
      stranded.push(it.Wed_category);
    }
  }
  return stranded;
}

export function BudgetItemTable(props: BudgetItemTableProps) {
  const { items, categories, onMutate, onError } = props;

  const [newRowCategory, setNewRowCategory] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddFormState>(() => emptyAddForm(''));
  const [addErrors, setAddErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // 카테고리별 그룹핑은 렌더마다 새로 계산한다(입력 크기 대비 저렴).
  const grouped = groupByCategory(items);
  const strandedCategories = findStrandedCategories(items, categories);

  /**
   * 사용자가 특정 카테고리 섹션의 "항목 추가" 버튼을 눌렀을 때 호출된다.
   * 폼을 열면서 `Wed_category`를 해당 섹션의 이름으로 pre-fill 하고
   * 기존 add 폼 상태를 초기화한다.
   */
  function handleOpenAdd(category: string): void {
    setAddForm(emptyAddForm(category));
    setAddErrors([]);
    setNewRowCategory(category);
  }

  /**
   * 인라인 추가 폼 취소. 저장 중일 때는 무시(더블 클릭 방지 + race 회피).
   */
  function handleCancelAdd(): void {
    if (submitting) return;
    setNewRowCategory(null);
    setAddForm(emptyAddForm(''));
    setAddErrors([]);
  }

  /**
   * 인라인 추가 폼 저장.
   *   1) `normalizeBudgetItem`으로 정규화 + 검증(카테고리·결제금액 필수).
   *   2) ok:false → 오류 메시지를 폼 하단에 노출하고 서버 호출은 생략.
   *   3) ok:true → `budgetApi.create` 호출. 성공 시 폼을 닫고 `onMutate`로
   *      상위 재조회를 트리거한다. 실패 시 표준 메시지를 `onError`로 상위에
   *      라우팅하고 폼은 그대로 유지(사용자가 재시도 가능).
   */
  async function handleSubmitAdd(): Promise<void> {
    if (submitting) return;
    setAddErrors([]);

    const result = normalizeBudgetItem(addForm);
    if (!result.ok) {
      setAddErrors(result.errors);
      return;
    }

    setSubmitting(true);
    try {
      await budgetApi.create(result.value);
      // 성공: 상위 재조회 후 폼 닫기. 재조회는 상위 책임(onMutate).
      setNewRowCategory(null);
      setAddForm(emptyAddForm(''));
      await onMutate();
    } catch (err) {
      if (onError) onError(extractMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * DataTable 인라인 편집 저장 핸들러. patch에 담긴 필드만 정규화한 뒤
   * `budgetApi.update`로 전송한다. 실패 시 throw → DataTable이 편집 모드를
   * 유지하고 `onError`로 메시지를 라우팅한다(Property 17).
   */
  async function handleRowEditSave(
    id: string,
    patch: Partial<BudgetItem>,
  ): Promise<void> {
    const normalized = normalizeEditPatch(patch);
    // 빈 patch(사용자가 아무것도 안 바꿈)라면 no-op이지만 방어적으로 호출.
    await budgetApi.update(id, normalized);
    await onMutate();
  }

  /**
   * DataTable 인라인 삭제 핸들러. 확인 다이얼로그는 DataTable이 처리하므로
   * 여기서는 API 호출 + 상위 재조회만 담당한다.
   */
  async function handleRowDelete(id: string): Promise<void> {
    await budgetApi.remove(id);
    await onMutate();
  }

  /**
   * 각 카테고리 섹션에서 사용하는 DataTable 열 정의. 카테고리 열은 섹션
   * 헤더가 이미 담당하므로 표에는 포함하지 않는다.
   *
   *   - 결제금액은 `formatKRW`로 표시(Requirement 5.5 · 원 단위 정수 저장,
   *     Requirement 7.7 · 세 자리 콤마 스타일과 통일). 편집 시에는 DataTable
   *     기본 텍스트 입력을 사용하되 저장 gate에서 `isValidAmount`로 재검증.
   *   - 그 외 열은 `null → ''` 폴백만 적용하여 자유 텍스트로 렌더.
   */
  const columns: DataTableColumn<BudgetItem>[] = [
    {
      key: 'Wed_item_name',
      header: '항목명',
      width: '160px',
      render: (row) => (row.Wed_item_name === null ? '' : row.Wed_item_name),
    },
    {
      key: 'Wed_payer',
      header: '결제자',
      width: '90px',
      render: (row) => (row.Wed_payer === null ? '' : row.Wed_payer),
      renderEdit: (row, patch, setPatch) => {
        const current =
          'Wed_payer' in patch
            ? ((patch.Wed_payer as string | null) ?? '')
            : (row.Wed_payer ?? '');
        return (
          <select
            className="field-input data-table-edit-input"
            aria-label="결제자"
            value={current}
            onChange={(e) =>
              setPatch({
                ...patch,
                Wed_payer: e.target.value === '' ? null : e.target.value,
              } as Partial<BudgetItem>)
            }
          >
            <option value="">-</option>
            {PAYER_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        );
      },
    },
    {
      key: 'Wed_amount',
      header: '결제금액',
      width: '130px',
      render: (row) => formatKRW(row.Wed_amount),
    },
    {
      key: 'Wed_due_date',
      header: '결제일',
      width: '120px',
      render: (row) => (row.Wed_due_date === null ? '' : row.Wed_due_date),
    },
    {
      key: 'Wed_pay_method',
      header: '결제수단',
      width: '110px',
      render: (row) => (row.Wed_pay_method === null ? '' : row.Wed_pay_method),
    },
    {
      key: 'Wed_vendor',
      header: '거래처',
      width: '120px',
      render: (row) => (row.Wed_vendor === null ? '' : row.Wed_vendor),
    },
    {
      key: 'Wed_note',
      header: '비고',
      width: '320px',
      render: (row) => (row.Wed_note === null ? '' : row.Wed_note),
    },
  ];

  // 렌더 순서: 마스터 카테고리 순 → stranded 카테고리 순.
  const displayCategories = [...categories, ...strandedCategories];

  return (
    <div className="budget-item-table">
      {displayCategories.map((categoryName) => {
        const rows = grouped[categoryName] ?? [];
        return (
          <section
            key={categoryName}
            className="budget-category-section"
            aria-label={`카테고리: ${categoryName}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-sm)',
              marginBottom: 'var(--space-xl)',
            }}
          >
            <div
              className="budget-category-header"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-md)',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--font-body-strong-size)',
                  fontWeight: 'var(--font-body-strong-weight)',
                  lineHeight: 'var(--font-body-strong-line-height)',
                  color: 'var(--ink)',
                }}
              >
                {categoryName}
              </h3>
              <div style={{ marginLeft: 'auto' }}>
                <PillButton
                  variant="primary"
                  onClick={() => handleOpenAdd(categoryName)}
                  disabled={submitting}
                >
                  항목 추가
                </PillButton>
              </div>
            </div>

            <DataTable<BudgetItem>
              rows={rows}
              columns={columns}
              onSaveEdit={handleRowEditSave}
              onDelete={handleRowDelete}
              onError={onError}
              emptyMessage="이 카테고리에 등록된 항목이 없습니다"
            />
          </section>
        );
      })}

      <Modal
        isOpen={newRowCategory !== null}
        onClose={handleCancelAdd}
        title="새 예산 항목"
        actions={
          <>
            <PillButton
              variant="secondary"
              onClick={handleCancelAdd}
              disabled={submitting}
            >
              취소
            </PillButton>
            <PillButton
              variant="primary"
              onClick={handleSubmitAdd}
              disabled={submitting}
            >
              저장
            </PillButton>
          </>
        }
      >
        <Select
          label="카테고리"
          required
          value={addForm.Wed_category}
          onChange={(v) => setAddForm({ ...addForm, Wed_category: v })}
          options={categories}
          placeholder="카테고리를 선택해주세요"
        />
        <TextField
          label="항목명"
          value={addForm.Wed_item_name}
          onChange={(v) => setAddForm({ ...addForm, Wed_item_name: v })}
        />
        <Select
          label="결제자"
          value={addForm.Wed_payer}
          onChange={(v) => setAddForm({ ...addForm, Wed_payer: v })}
          options={PAYER_OPTIONS}
          placeholder="결제자를 선택해주세요"
        />
        <NumberField
          label="결제금액"
          required
          value={addForm.Wed_amount === '' ? null : Number(addForm.Wed_amount)}
          onChange={(v) =>
            setAddForm({
              ...addForm,
              Wed_amount: v === null ? '' : String(v),
            })
          }
        />
        <DateField
          label="결제일"
          value={addForm.Wed_due_date}
          onChange={(v) => setAddForm({ ...addForm, Wed_due_date: v })}
        />
        <TextField
          label="결제수단"
          value={addForm.Wed_pay_method}
          onChange={(v) => setAddForm({ ...addForm, Wed_pay_method: v })}
        />
        <TextField
          label="거래처"
          value={addForm.Wed_vendor}
          onChange={(v) => setAddForm({ ...addForm, Wed_vendor: v })}
        />
        <TextField
          label="비고"
          value={addForm.Wed_note}
          onChange={(v) => setAddForm({ ...addForm, Wed_note: v })}
        />
        {addErrors.length > 0 && <InlineError>{addErrors[0]}</InlineError>}
      </Modal>
    </div>
  );
}
