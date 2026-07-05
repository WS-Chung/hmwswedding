// Schedule_Manager — Supabase 데이터 접근 계층 (`Wed_Schedule` 테이블 전용).
//
// 이 모듈은 Requirement 2의 CRUD 요구(2.1, 2.9, 2.10, 2.11, 2.12, 2.13)와
// Requirement 9.6의 "Supabase JS SDK 경유 접근" 요구를 만족시키기 위한 얇은
// 어댑터다. 도메인 정규화(빈 문자열 → null, 필수 필드 검증)는 상위 폼 계층의
// `normalizeSchedule`이 담당하고, 이 파일은 순수하게 SDK 호출과 오류 사상만
// 책임진다.
//
// 오류 처리 규약(design.md § Error Handling):
//   - Supabase가 error를 실어 응답하거나 fetch 자체가 실패하면 원문을
//     `mapSupabaseError`로 5종 표준 메시지 중 하나로 사상하고
//     `throw new Error(msg)`로 던진다.
//   - 상위 컴포넌트는 catch 블록에서 `err.message`만 읽어 InlineError에
//     그대로 표시하면 되며, 그 결과 UI에 노출되는 문구는 반드시 표준화된
//     5종 중 하나임이 타입 시스템 수준에서 보장된다(Requirement 2.12).
//
// 참고: `Wed_Schedule` 스키마는 design.md § Schema 및 `db/schema.sql`에
// 정의되어 있다. `Wed_id`는 서버 측 `gen_random_uuid()`가, `Wed_created_at`은
// `default now()`가 채워주므로 create 입력에서 두 필드는 제외한다.

import { supabase } from '../../lib/supabaseClient';
import { mapSupabaseError } from '../../lib/errorMapping';

/**
 * `Wed_Schedule` 테이블의 한 행(Schedule_Record)에 대한 TypeScript 뷰.
 *
 * 컬럼 매핑(Requirement 2.13):
 *   - `Wed_id`         : UUID PK (서버 생성).
 *   - `Wed_date`       : ISO 날짜 문자열 "YYYY-MM-DD" (DATE 컬럼).
 *   - `Wed_place`      : 장소 (TEXT, 필수).
 *   - `Wed_time`       : 시간 "HH:MM" 또는 null (TIME 컬럼).
 *   - `Wed_schedule`   : 일정내용 (TEXT, 필수).
 *   - `Wed_note`       : 메모 (TEXT, 선택 · null 허용, Requirement 2.14).
 *   - `Wed_created_at` : 생성 시각 (timestamptz, 서버 default now()).
 */
export type ScheduleRecord = {
  Wed_id: string;
  Wed_date: string;
  Wed_place: string;
  Wed_time: string | null;
  Wed_schedule: string;
  Wed_note: string | null;
  Wed_created_at: string;
};

/** `Wed_Schedule` 테이블 이름 상수 — 오타 방지 목적. */
const TABLE = 'Wed_Schedule';

/**
 * 2자리 zero-pad. `listByMonth`가 만드는 [start, end) 경계 문자열에서 쓰인다.
 * month=7 → "07", month=12 → "12" 처럼 항상 두 자리를 보장한다.
 */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * (year, month1to12) → `[start, endExclusive)` 반열림 범위의 ISO 날짜 문자열
 * 두 개를 계산한다.
 *
 *   month=7  → ("2026-07-01", "2026-08-01")
 *   month=12 → ("2026-12-01", "2027-01-01")   ← 연도 이월 처리
 *
 * 반열림 구간을 쓰는 이유: `Wed_date`는 DATE 타입이므로 `< 다음 달 1일`이
 * "해당 월 마지막 날 포함"과 동치이며, 월의 길이(28/29/30/31)를 몰라도
 * 안전하게 필터할 수 있다.
 */
function monthRange(year: number, month1to12: number): { start: string; endExclusive: string } {
  const start = `${year}-${pad2(month1to12)}-01`;
  const nextYear = month1to12 === 12 ? year + 1 : year;
  const nextMonth = month1to12 === 12 ? 1 : month1to12 + 1;
  const endExclusive = `${nextYear}-${pad2(nextMonth)}-01`;
  return { start, endExclusive };
}

export const scheduleApi = {
  /**
   * 모든 Schedule_Record를 `Wed_date` 오름차순으로 반환한다(Requirement 2.1).
   *
   * 정렬은 서버 측(`.order`)에서 수행하고, 클라이언트는 반환 배열의 순서를
   * 그대로 신뢰한다. Requirement 2.1의 "표시 순서" 요구를 만족한다.
   */
  async list(): Promise<ScheduleRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('Wed_date', { ascending: true });

    if (error) throw new Error(mapSupabaseError(error));
    return (data ?? []) as ScheduleRecord[];
  },

  /**
   * 특정 (year, month1to12) 월에 속하는 Schedule_Record만 필터해서 반환한다.
   *
   * 필터는 서버 측 `.gte / .lt` 두 조건으로 `[YYYY-MM-01, YYYY-(MM+1)-01)`
   * 반열림 구간을 표현하며, 결과 역시 `Wed_date` 오름차순으로 정렬한다.
   * 달력 뷰(`SchedulePage`)는 통상 `list()` 결과에서 파생 계산하지만,
   * 대량 데이터 시 이 메서드로 트래픽을 줄일 수 있다(Requirement 2.1).
   *
   * @param year        4자리 서기 연도 (예: 2026).
   * @param month1to12  1..12 사이의 월. 12를 넘길 경우 상위에서 정규화할 것.
   */
  async listByMonth(year: number, month1to12: number): Promise<ScheduleRecord[]> {
    const { start, endExclusive } = monthRange(year, month1to12);
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .gte('Wed_date', start)
      .lt('Wed_date', endExclusive)
      .order('Wed_date', { ascending: true });

    if (error) throw new Error(mapSupabaseError(error));
    return (data ?? []) as ScheduleRecord[];
  },

  /**
   * 새 Schedule_Record를 삽입하고 서버가 채운(`Wed_id`, `Wed_created_at`
   * 포함) 완전한 행을 반환한다(Requirement 2.9).
   *
   * 입력에서 `Wed_id`와 `Wed_created_at`은 서버가 채우므로 제외한다.
   * `Wed_time` / `Wed_note`는 상위(`normalizeSchedule`)에서 빈 문자열이
   * `null`로 사상된 채로 넘어오는 것을 전제로 한다(Requirement 2.14).
   */
  async create(
    input: Omit<ScheduleRecord, 'Wed_id' | 'Wed_created_at'>,
  ): Promise<ScheduleRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input)
      .select()
      .single();

    if (error) throw new Error(mapSupabaseError(error));
    return data as ScheduleRecord;
  },

  /**
   * 지정된 `Wed_id`의 Schedule_Record를 patch로 업데이트하고, 갱신된 행을
   * 반환한다(Requirement 2.10).
   *
   * `patch`는 부분 필드만 담을 수 있으며, 상위에서 `Wed_id`와
   * `Wed_created_at`을 넘겨도 서버가 안전하게 무시한다(RLS + PK 규약).
   * 관례상 호출부는 이 두 키를 제외한 값만 넘긴다.
   */
  async update(id: string, patch: Partial<ScheduleRecord>): Promise<ScheduleRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('Wed_id', id)
      .select()
      .single();

    if (error) throw new Error(mapSupabaseError(error));
    return data as ScheduleRecord;
  },

  /**
   * 지정된 `Wed_id`의 Schedule_Record를 삭제한다(Requirement 2.11).
   *
   * 성공 시 반환값 없음. 실패 시 표준 메시지로 사상되어 던져진다.
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('Wed_id', id);
    if (error) throw new Error(mapSupabaseError(error));
  },
};
