// features/budget/budgetApi.ts
//
// Budget_Manager 도메인의 Supabase 데이터 액세스 계층.
//
// 이 모듈은 `Wed_Budget_Item` 테이블 한 곳만을 다루는 순수 어댑터다.
// 카테고리 마스터(`Wed_Budget_Category`)는 자매 모듈 `categoryApi.ts`가
// 담당하고, 두 모듈이 각자의 테이블에 대해서만 CRUD 책임을 지므로 서로의
// 스키마 변경이 상대에 새어 들지 않는다.
//
// 오류 처리 계약(design.md § 클라이언트 측 오류 처리 원칙):
//   - 성공 시 도메인 타입(`BudgetItem`)만 반환한다.
//   - 실패 시(Supabase PostgrestError · 네트워크 오류 · unknown) 원문 오류는
//     `mapSupabaseError`로 5종 표준 사용자 메시지 중 하나로 사상되어
//     `throw new Error(mapSupabaseError(err))` 로 재던져진다. 원문 오류의
//     로깅은 `mapSupabaseError` 내부의 `console.error`가 담당한다.
//   - Optimistic update를 하지 않으므로 호출자(UI)는 이 API의 resolve
//     결과가 도착한 뒤에만 로컬 state를 갱신한다.
//
// Validates: Requirements 5.2, 5.3, 5.4, 9.6

import { supabase } from '../../lib/supabaseClient';
import { mapSupabaseError } from '../../lib/errorMapping';

/**
 * `Wed_Budget_Item` 한 행에 대응하는 도메인 레코드.
 *
 * 컬럼 매핑(design.md § Budget_Item):
 *   - `Wed_id`           : UUID PK (서버 생성).
 *   - `Wed_category`     : 대분류 이름. `Wed_Budget_Category.Wed_name` 참조.
 *                          하드 FK 없이 애플리케이션 레이어에서 참조 무결성을
 *                          강제한다(design.md § DB 참조 무결성 노트).
 *   - `Wed_item_name`    : 항목명 (선택, 빈 값은 null).
 *   - `Wed_payer`        : 결제자 (선택, '혜민' | '운석' | null).
 *   - `Wed_amount`       : 결제금액. 0 이상 정수, 필수(Requirement 5.9).
 *                          DB의 CHECK 제약(`>= 0`)이 이중 안전망 역할을 한다.
 *   - `Wed_due_date`     : 결제(예정)일 "YYYY-MM-DD" 또는 null (DATE).
 *   - `Wed_pay_method`   : 결제수단 (선택).
 *   - `Wed_vendor`       : 거래처 (선택).
 *   - `Wed_note`         : 비고 (선택).
 *   - `Wed_created_at`   : 생성 시각 (서버 default `now()`).
 */
export type BudgetItem = {
  Wed_id: string;
  Wed_category: string;
  Wed_item_name: string | null;
  Wed_payer: string | null;
  Wed_amount: number;
  Wed_due_date: string | null;
  Wed_pay_method: string | null;
  Wed_vendor: string | null;
  Wed_note: string | null;
  Wed_created_at: string;
};

/** 대상 테이블 이름. `Wed_` 접두사 규칙(Requirement 9.2)에 따른 고정 상수. */
const TABLE = 'Wed_Budget_Item' as const;

/**
 * INSERT 시 클라이언트가 제공해야 하는 필드 집합.
 * `Wed_id`와 `Wed_created_at`은 서버(default `gen_random_uuid()` / `now()`)가
 * 채우므로 입력에서 제외한다.
 */
export type BudgetItemCreateInput = Omit<BudgetItem, 'Wed_id' | 'Wed_created_at'>;

/**
 * UPDATE 시 patch로 허용되는 필드 집합.
 * 서버 소유 필드(`Wed_id`, `Wed_created_at`)는 변경 대상에서 제외한다.
 */
export type BudgetItemUpdatePatch = Partial<Omit<BudgetItem, 'Wed_id' | 'Wed_created_at'>>;

/**
 * Budget_Manager 페이지가 사용하는 `Wed_Budget_Item` CRUD API.
 *
 * 모든 메서드는 실패 시 `throw new Error(mapSupabaseError(err))`로 표준화된
 * 사용자 메시지만 노출한다. 호출부는 `try/catch`로 잡아 `<InlineError />`에
 * `error.message`를 그대로 표시하면 된다.
 */
export const budgetApi = {
  /**
   * 모든 Budget_Item을 반환한다(Requirement 5.2 - 목록 조회 기반).
   *
   * 정렬은 `Wed_created_at` 오름차순 — 사용자가 추가한 순서대로 안정적으로
   * 나열되도록 하기 위함이다. 카테고리 그룹핑 및 파생 값(Total_Spent 등)
   * 계산은 상위 순수 로직(`lib/budget.ts`, `lib/category.ts`)이 담당한다.
   */
  async list(): Promise<BudgetItem[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('Wed_created_at', { ascending: true });

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return (data ?? []) as BudgetItem[];
  },

  /**
   * 새 Budget_Item 한 건을 INSERT한다(Requirement 5.2).
   *
   * `input`은 폼 정규화 계층에서 빈 문자열을 null로 사상하고 필수 필드
   * (`Wed_category`, `Wed_amount`)의 유효성을 확인한 상태여야 한다
   * (design.md § Property 14). 성공 시 서버가 채운 `Wed_id`,
   * `Wed_created_at`를 포함한 완성 레코드를 반환한다.
   */
  async create(input: BudgetItemCreateInput): Promise<BudgetItem> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as BudgetItem;
  },

  /**
   * 지정한 `id` 행의 컬럼을 부분 갱신한다(Requirement 5.3).
   *
   * `patch`에 포함된 필드만 UPDATE되며, 빈 객체를 넘겨도 안전하다(no-op).
   * 성공 시 갱신된 전체 레코드를 반환한다.
   */
  async update(id: string, patch: BudgetItemUpdatePatch): Promise<BudgetItem> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('Wed_id', id)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as BudgetItem;
  },

  /**
   * 지정한 `id` 행을 삭제한다(Requirement 5.4).
   *
   * 성공 시 아무 값도 반환하지 않는다. 호출부는 로컬 리스트에서 해당 행을
   * 제거하는 방식으로 UI를 갱신한다.
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('Wed_id', id);

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
  },
};
