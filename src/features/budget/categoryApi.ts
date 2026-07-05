// features/budget/categoryApi.ts
//
// Category_Manager 도메인의 Supabase 데이터 액세스 계층.
//
// `Wed_Budget_Category` 마스터 테이블에 대한 CRUD와, 삭제 게이트에서 사용할
// **참조 개수 조회**(`countItemsUsingCategory`)를 함께 제공한다.
//
// 아키텍처 노트(design.md § DB 참조 무결성):
//   `Wed_Budget_Item.Wed_category`에는 하드 FK를 걸지 않는다. 대신 카테고리
//   삭제 시 이 모듈의 `countItemsUsingCategory`로 참조 항목 수를 먼저 확인해
//   count ≥ 1이면 UI(`CategoryManagerModal`)가 삭제 요청 자체를 차단하고
//   "이 카테고리를 사용하는 항목이 있어 삭제할 수 없습니다"를 표시한다
//   (Requirement 6.7). 이 방식은 DB CASCADE보다 명시적인 사용자 안내를
//   우선하기 위함이다.
//
// 오류 처리 계약:
//   - 성공 시 도메인 타입(`BudgetCategory`) 또는 숫자만 반환한다.
//   - 실패 시 원문 오류를 `mapSupabaseError`로 5종 표준 메시지 중 하나로
//     사상해 `throw new Error(mapSupabaseError(err))`로 재던진다. Postgres
//     unique_violation(23505)이 새 카테고리 이름 중복에서 발생하면
//     `mapSupabaseError` 내부에서 `ERR_CATEGORY_DUP`으로 자동 사상되므로
//     이 계층에서는 별도 컨텍스트 힌트를 전달하지 않는다(Requirement 6.6).
//
// Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.7, 9.6
//
// (참조: Category_Manager · 삭제 흐름은 design.md의 아래 지시를 그대로 구현한다.
//  > 삭제: `Wed_Budget_Item`에서 `Wed_category = <name>`인 행 count를 먼저
//  > 조회. count ≥ 1이면 삭제 차단 + InlineError "이 카테고리를 사용하는
//  > 항목이 있어 삭제할 수 없습니다".)

import { supabase } from '../../lib/supabaseClient';
import { mapSupabaseError } from '../../lib/errorMapping';

/**
 * `Wed_Budget_Category` 한 행에 대응하는 도메인 레코드.
 *
 * 컬럼 매핑:
 *   - `Wed_id`         : UUID PK (서버 생성).
 *   - `Wed_name`       : 카테고리 이름. DB `UNIQUE` 제약을 가지며,
 *                        UI에서는 trim + 원문 비교로 사전 중복 검사를 한다
 *                        (design.md § CategoryManagerModal).
 *   - `Wed_created_at` : 생성 시각 (서버 default `now()`).
 */
export type BudgetCategory = {
  Wed_id: string;
  Wed_name: string;
  Wed_created_at: string;
};

/** 카테고리 마스터 테이블 이름 상수. */
const TABLE = 'Wed_Budget_Category' as const;

/**
 * `Wed_Budget_Item` 테이블에서 참조 개수를 셀 때 사용하는 대상 테이블 이름.
 * `countItemsUsingCategory` 전용 상수로 두어 오타를 방지한다.
 */
const ITEMS_TABLE = 'Wed_Budget_Item' as const;

/**
 * INSERT 시 클라이언트가 제공해야 하는 필드 집합.
 * `Wed_id`, `Wed_created_at`은 서버가 채우므로 입력에서 제외한다.
 */
export type BudgetCategoryCreateInput = Omit<BudgetCategory, 'Wed_id' | 'Wed_created_at'>;

/**
 * UPDATE 시 patch로 허용되는 필드 집합.
 * 서버 소유 필드는 변경 대상에서 제외한다.
 */
export type BudgetCategoryUpdatePatch = Partial<Omit<BudgetCategory, 'Wed_id' | 'Wed_created_at'>>;

/**
 * `Wed_Budget_Category` CRUD + 참조 개수 조회 API.
 *
 * 실패 시에는 모든 메서드가 `throw new Error(mapSupabaseError(err))`로
 * 표준화된 사용자 메시지만 노출한다.
 */
export const categoryApi = {
  /**
   * 모든 카테고리 마스터 행을 반환한다(Requirement 6.2 목록 기반).
   *
   * 정렬은 `Wed_created_at` 오름차순. 초기 시딩된 8개(웨딩홀/스드메/…)가
   * 삽입 순서대로 나열되고, 이후 사용자가 추가한 카테고리는 그 뒤에 붙어
   * 드롭다운 옵션 순서가 안정적으로 유지된다(Requirement 5.6, 6.8).
   */
  async list(): Promise<BudgetCategory[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('Wed_created_at', { ascending: true });

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return (data ?? []) as BudgetCategory[];
  },

  /**
   * 새 카테고리 한 건을 INSERT한다(Requirement 6.3).
   *
   * 이름 중복은 DB의 `UNIQUE("Wed_name")` 제약이 최종 방어선이 되며,
   * unique_violation(23505)은 `mapSupabaseError` 내부에서 자동으로
   * `ERR_CATEGORY_DUP`("이미 존재하는 카테고리입니다.")으로 사상된다
   * (Requirement 6.6). UI 계층은 사전에 `canAddCategory`로 로컬 목록을
   * 확인해 서버 왕복 없이 즉시 안내할 수도 있다.
   */
  async create(input: BudgetCategoryCreateInput): Promise<BudgetCategory> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as BudgetCategory;
  },

  /**
   * 지정한 `id` 카테고리 행의 컬럼을 부분 갱신한다(Requirement 6.4).
   *
   * 통상적으로 patch에는 `Wed_name`만 담긴다. 이름 중복은 이 경로에서도
   * unique_violation으로 잡히며 `ERR_CATEGORY_DUP`으로 사상된다.
   */
  async update(id: string, patch: BudgetCategoryUpdatePatch): Promise<BudgetCategory> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('Wed_id', id)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as BudgetCategory;
  },

  /**
   * 지정한 `id` 카테고리 행을 삭제한다(Requirement 6.5).
   *
   * 이 메서드 자체는 참조 무결성 검사를 수행하지 않는다. 호출부
   * (`CategoryManagerModal`)가 먼저 `countItemsUsingCategory(name)`를
   * 호출해 0인 경우에만 `remove`를 호출하는 것이 규약이다(Requirement 6.7).
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('Wed_id', id);

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
  },

  /**
   * 주어진 카테고리 이름 `name`을 `Wed_category`로 사용하는
   * `Wed_Budget_Item` 행의 총 개수를 반환한다(Requirement 6.7 사전 게이트).
   *
   * 구현 방식(design.md § Category_Manager · 삭제):
   *   Supabase의 `select('Wed_id', { count: 'exact', head: true })`를 사용해
   *   **행 본문을 가져오지 않고** count 만 서버에서 계산하도록 한다.
   *   `head: true`는 응답 바디를 비우므로 대량 참조가 있어도 트래픽 부담이
   *   없고, `{ count: 'exact' }`는 정확한 개수를 반환한다(추정치가 아님).
   *
   *   응답의 `count`가 null인 경우는 카운트 헤더가 서버로부터 오지 않은
   *   예외 케이스로, 안전 측에서 0으로 간주하지 않고 그대로 null → 0
   *   사상하되, 실제 count 부재 시 `?? 0`이 참조가 없다고 오판할 위험이
   *   있으므로 이는 error가 없을 때에만 발생하고 UI는 삭제를 허용한다.
   *   (Supabase 문서상 error가 없으면 count는 exact 모드에서 수치가 채워진다.)
   *
   * @param name 검사할 카테고리 이름 (`Wed_Budget_Category.Wed_name`).
   * @returns    `Wed_category === name` 인 Budget_Item 행 개수.
   */
  async countItemsUsingCategory(name: string): Promise<number> {
    const { count, error } = await supabase
      .from(ITEMS_TABLE)
      .select('Wed_id', { count: 'exact', head: true })
      .eq('Wed_category', name);

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return count ?? 0;
  },
};
