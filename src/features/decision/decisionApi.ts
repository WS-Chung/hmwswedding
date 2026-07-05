/**
 * Decision_Manager 데이터 계층 (`features/decision/decisionApi.ts`).
 *
 * `Wed_Decision` 테이블에 대한 CRUD를 담당하는 유일한 진입점.
 * DecisionPage 는 이 모듈만을 통해 Supabase 와 대화하며, Supabase 원문
 * 오류는 이 계층에서 모두 `mapSupabaseError` 로 사상되어
 * `Error(사용자용 메시지)` 로 재던져진다(design.md § 클라이언트 측 오류
 * 처리 원칙, § Decision_Manager).
 *
 * 오류 처리 계약:
 *   - 성공 시 도메인 타입(`DecisionRecord`)을 반환한다.
 *   - 실패 시 `throw new Error(mapSupabaseError(err))`. 호출부(DecisionPage)
 *     는 catch 블록에서 `error.message` 를 그대로 `<InlineError />` 로
 *     노출하고, 목록 state 는 이전 상태를 유지한다(Requirement 2.5 준용).
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 9.6
 */

import { supabase } from '../../lib/supabaseClient';
import { mapSupabaseError } from '../../lib/errorMapping';

/** `Wed_Decision` 테이블의 한 행. design.md § Decision_Manager 참조. */
export type DecisionRecord = {
  Wed_id: string;
  Wed_item: string;
  Wed_stakeholder: string | null;
  /** 원 단위 정수, NULL 허용 (Requirement 3.5, 3.6). */
  Wed_expense: number | null;
  /** URL 또는 NULL (Requirement 3.5, 3.7). */
  Wed_link: string | null;
  Wed_comment: string | null;
  Wed_created_at: string;
};

/** 대상 테이블 이름을 단일 상수로 고정(오타 방지, Requirement 9.2 규칙 준수). */
const TABLE = 'Wed_Decision' as const;

/**
 * `Wed_Decision` CRUD API.
 *
 * scheduleApi 와 동일한 형태로, 성공 시 도메인 값을 반환하고 실패 시
 * `mapSupabaseError` 로 사상된 표준화 메시지를 담은 `Error` 를 던진다.
 */
export const decisionApi = {
  /**
   * 모든 `Wed_Decision` 행을 반환한다.
   *
   * Requirement 3.1 은 "목록에 표시" 만을 규정하고 정렬 순서는
   * 명시하지 않는다. UI 상 안정적인 표시 순서를 보장하기 위해
   * 삽입 시각(`Wed_created_at`) 오름차순으로 정렬한다(가장 오래된
   * 결정이 위에 오는 chronological insertion order).
   */
  async list(): Promise<DecisionRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('Wed_created_at', { ascending: true });

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return (data ?? []) as DecisionRecord[];
  },

  /**
   * 새 Decision_Record 를 INSERT 하고 저장된 행을 반환한다(Requirement 3.2).
   *
   * `Wed_id` / `Wed_created_at` 은 DB 기본값(`gen_random_uuid()`, `now()`)
   * 이 채우므로 입력에서 제외한다.
   */
  async create(
    input: Omit<DecisionRecord, 'Wed_id' | 'Wed_created_at'>,
  ): Promise<DecisionRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as DecisionRecord;
  },

  /**
   * `Wed_id === id` 인 행의 지정 컬럼을 UPDATE 하고 갱신된 행을 반환한다
   * (Requirement 3.3).
   */
  async update(
    id: string,
    patch: Partial<DecisionRecord>,
  ): Promise<DecisionRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('Wed_id', id)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as DecisionRecord;
  },

  /**
   * `Wed_id === id` 인 행을 DELETE 한다(Requirement 3.4).
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('Wed_id', id);

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
  },
};
