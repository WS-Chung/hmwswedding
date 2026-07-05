// features/contact/contactApi.ts
//
// Contact_Manager 도메인의 Supabase 데이터 액세스 계층.
//
// 이 모듈은 `Wed_Contact` 테이블에 대한 CRUD를 담당하며, 다음 계약을 지킨다.
//
//   - 성공 시 도메인 타입(`ContactRecord`)만 반환한다.
//   - 실패 시(Supabase PostgrestError · 네트워크 오류 · 그 외 unknown) 원문
//     오류는 `mapSupabaseError`를 통해 5종 표준 사용자 메시지 중 하나로
//     사상한 뒤 `throw new Error(mapSupabaseError(err))`로 재던진다.
//     원문 오류는 `mapSupabaseError` 내부에서 `console.error`로 남긴다.
//   - Optimistic update를 하지 않으므로, 호출자(UI)는 이 API의 resolve
//     결과가 도착한 뒤에만 로컬 state를 갱신한다(design.md § 클라이언트 측
//     오류 처리 원칙).
//
// Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 9.6

import { supabase } from '../../lib/supabaseClient';
import { mapSupabaseError } from '../../lib/errorMapping';

/**
 * `Wed_Contact` 한 행에 대응하는 도메인 레코드.
 *
 * 컬럼 매핑(Requirement 8.5):
 *   - `Wed_id`         : UUID PK (서버 생성)
 *   - `Wed_company`    : 업체 (필수, TEXT)
 *   - `Wed_manager`    : 담당자 (선택, 빈 값은 null)
 *   - `Wed_phone`      : 전화번호 (선택, 자유 형식 문자열 · Requirement 8.7)
 *   - `Wed_email`      : 이메일 (선택, 형식 검증은 UI/normalize 계층에서)
 *   - `Wed_note`       : 비고 (선택)
 *   - `Wed_created_at` : 생성 시각 (서버 default `now()`)
 */
export type ContactRecord = {
  Wed_id: string;
  Wed_company: string;
  Wed_manager: string | null;
  Wed_phone: string | null;
  Wed_email: string | null;
  Wed_note: string | null;
  Wed_created_at: string;
};

/** 대상 테이블 이름. `Wed_` 접두사 규칙(Requirement 9.2)에 따른 고정 상수. */
const TABLE = 'Wed_Contact' as const;

/** `select()` 절에서 사용할 컬럼 목록. `ContactRecord` 필드와 1:1 대응. */
const COLUMNS =
  'Wed_id, Wed_company, Wed_manager, Wed_phone, Wed_email, Wed_note, Wed_created_at' as const;

/**
 * INSERT 시 클라이언트가 제공해야 하는 필드 집합.
 * `Wed_id`와 `Wed_created_at`은 서버에서 채운다.
 */
export type ContactCreateInput = Omit<ContactRecord, 'Wed_id' | 'Wed_created_at'>;

/**
 * UPDATE 시 patch로 허용되는 필드 집합.
 * 서버 소유 필드(`Wed_id`, `Wed_created_at`)는 변경 대상에서 제외한다.
 */
export type ContactUpdatePatch = Partial<Omit<ContactRecord, 'Wed_id' | 'Wed_created_at'>>;

/**
 * Contact_Manager 페이지가 사용하는 Supabase 데이터 액세스 객체.
 *
 * 모든 메서드는 실패 시 `throw new Error(mapSupabaseError(err))`로 표준화된
 * 사용자 메시지만 노출한다. 호출부는 `try/catch` 로 잡아 `<InlineError />` 에
 * 그대로 표시하면 된다.
 */
export const contactApi = {
  /**
   * `Wed_Contact` 전 행을 조회한다(Requirement 8.1).
   *
   * 정렬은 `Wed_created_at ASC` — 사용자가 추가한 순서대로 표시하여
   * 목록의 안정적인 나열을 보장한다. 요구사항이 특정 정렬을 강제하지
   * 않으므로 이 순서는 UI 계층에서 재정렬 가능하다.
   */
  async list(): Promise<ContactRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .order('Wed_created_at', { ascending: true });

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return (data ?? []) as ContactRecord[];
  },

  /**
   * 새 Contact_Record 한 건을 INSERT 한다(Requirement 8.2).
   *
   * `input`은 사용자 입력을 `normalizeContact`로 정규화한 결과여야 한다.
   * 성공 시 서버가 채운 `Wed_id`, `Wed_created_at`를 포함한 완성 레코드를
   * 반환한다.
   */
  async create(input: ContactCreateInput): Promise<ContactRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input)
      .select(COLUMNS)
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as ContactRecord;
  },

  /**
   * 지정한 `id` 행의 컬럼을 부분 갱신한다(Requirement 8.3).
   *
   * `patch`에 포함된 필드만 UPDATE 되며, 빈 객체를 넘겨도 안전하다
   * (서버는 no-op 처리). 성공 시 갱신된 전체 레코드를 반환한다.
   */
  async update(id: string, patch: ContactUpdatePatch): Promise<ContactRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('Wed_id', id)
      .select(COLUMNS)
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as ContactRecord;
  },

  /**
   * 지정한 `id` 행을 삭제한다(Requirement 8.4).
   *
   * 성공 시 아무 값도 반환하지 않는다. 호출부는 로컬 리스트에서 해당
   * 행을 제거하는 방식으로 UI를 갱신한다.
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('Wed_id', id);

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
  },
};
