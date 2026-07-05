/**
 * Supabase / 네트워크 오류 → 사용자 메시지 표준화 계층.
 *
 * design.md § Error Handling · "Supabase 오류 → 사용자 메시지 매핑" 표에
 * 정의된 5종 문구를 상수로 고정하고, 어떤 원문 오류가 들어와도 이 5종 중
 * 하나로만 사상하는 총함수(total function) `mapSupabaseError`를 노출한다.
 *
 * 설계 원칙:
 * - 원문 Supabase 오류(PostgrestError · AuthError · fetch TypeError · unknown)는
 *   개발자 디버깅용으로 `console.error`에 남기고, UI에는 절대 노출하지 않는다
 *   (design.md § 클라이언트 측 오류 처리 원칙).
 * - 반환 문자열은 반드시 아래 5개 상수 중 하나이며, 그 외 값을 반환하는 경로는
 *   존재하지 않는다(Property 17의 "표준화 메시지" 요건).
 * - 카테고리 도메인의 사전 검사(canAddCategory / canDeleteCategory)에서
 *   발생한 오류는 서버 응답이 없거나 신뢰할 수 없으므로 호출부가
 *   `context` 인자로 명시적으로 힌트를 넘긴다.
 *
 * Validates: Requirements 2.5
 */

/** 상황 1 — 네트워크(fetch) 자체가 실패했을 때 표시할 문구. */
export const ERR_NETWORK = '네트워크 연결을 확인해 주세요.' as const;

/** 상황 2 — Supabase 4xx 응답(RLS 거부, 검증 실패 등)에 대응하는 문구. */
export const ERR_SAVE_FAILED = '저장에 실패했습니다. 잠시 후 다시 시도해 주세요.' as const;

/** 상황 3 — Supabase 5xx 응답에 대응하는 문구. */
export const ERR_TEMPORARY = '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' as const;

/** 상황 4 — 유일성 제약(카테고리 이름 중복)에 대응하는 문구. */
export const ERR_CATEGORY_DUP = '이미 존재하는 카테고리입니다.' as const;

/** 상황 5 — 카테고리 참조 존재로 삭제가 불가능할 때의 문구. */
export const ERR_CATEGORY_REF = '이 카테고리를 사용하는 항목이 있어 삭제할 수 없습니다.' as const;

/**
 * `mapSupabaseError`가 반환할 수 있는 값의 유니온 타입.
 *
 * 반환값은 항상 이 5개 문자열 리터럴 중 하나이며, 이는 타입 시스템 수준에서
 * "표준화 메시지 5종 이외의 값이 UI로 흘러가지 않는다"는 불변식을 보장한다.
 */
export type MappedError =
  | typeof ERR_NETWORK
  | typeof ERR_SAVE_FAILED
  | typeof ERR_TEMPORARY
  | typeof ERR_CATEGORY_DUP
  | typeof ERR_CATEGORY_REF;

/**
 * 카테고리 도메인 전용 컨텍스트 힌트.
 *
 * - `'category_duplicate'` : 새 카테고리 추가 시 프론트에서 canAddCategory
 *   또는 서버에서 unique_violation(23505)이 관측된 흐름.
 * - `'category_reference'` : 카테고리 삭제 시 프론트에서 canDeleteCategory가
 *   false를 반환한 흐름(참조 항목 존재).
 */
export type ErrorContext = 'category_duplicate' | 'category_reference';

/** Postgres unique_violation SQLSTATE. Supabase는 그대로 `code` 필드에 실어준다. */
const PG_UNIQUE_VIOLATION = '23505';

/** 네트워크 오류로 간주할 message keyword 목록(대소문자 무시). */
const NETWORK_KEYWORDS = ['fetch', 'network'] as const;

/** 오류 객체에서 안전하게 필드를 뽑기 위한 최소 타입. */
interface MaybeSupabaseError {
  readonly status?: unknown;
  readonly code?: unknown;
  readonly message?: unknown;
  readonly name?: unknown;
}

/**
 * 임의의 unknown 값에서 숫자를 안전하게 추출한다.
 * - number 타입이고 유한하면 그대로 반환.
 * - 순수 정수 문자열이면 Number 변환 값을 반환.
 * - 그 외는 undefined.
 */
function readNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v)) return Number(v);
  return undefined;
}

/** 임의의 unknown 값에서 문자열을 안전하게 추출한다. */
function readString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/**
 * 오류가 네트워크(fetch) 실패인지 판정한다.
 *
 * 감지 규칙:
 *   1. `err instanceof TypeError` — 브라우저의 fetch가 네트워크 실패 시
 *      던지는 표준 오류.
 *   2. `err.message`에 "fetch" 또는 "network" 부분 문자열이 포함
 *      (대소문자 무시). Supabase JS 내부에서 감싼 fetch 실패 문구도
 *      함께 잡히도록 한다.
 */
function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  const raw = typeof err === 'object' && err !== null ? (err as MaybeSupabaseError) : null;
  const msg = readString(raw?.message);
  if (!msg) return false;
  const lower = msg.toLowerCase();
  return NETWORK_KEYWORDS.some((k) => lower.includes(k));
}

/**
 * 임의의 오류 객체를 5종 사용자 메시지 중 하나로 사상한다.
 *
 * 우선순위(위에서 아래로, 먼저 매칭되는 규칙이 반환값을 결정한다):
 *   1. `context === 'category_reference'`
 *        → **ERR_CATEGORY_REF** ("이 카테고리를 사용하는 항목이 있어 삭제할 수 없습니다.")
 *   2. `context === 'category_duplicate'` 또는
 *      `err.code === '23505'` (Postgres unique_violation)
 *        → **ERR_CATEGORY_DUP** ("이미 존재하는 카테고리입니다.")
 *   3. 네트워크(fetch) 실패 감지 (`TypeError` 또는 message에 fetch/network 포함)
 *        → **ERR_NETWORK** ("네트워크 연결을 확인해 주세요.")
 *   4. `err.status`가 5xx (500–599)
 *        → **ERR_TEMPORARY** ("일시적인 오류가 발생했습니다. …")
 *   5. `err.status`가 4xx (400–499) 또는 그 외의 알 수 없는 실패
 *        → **ERR_SAVE_FAILED** ("저장에 실패했습니다. …")
 *
 * 원문 오류는 개발자 디버깅용으로 `console.error`에만 남긴다.
 *
 * @param err     Supabase PostgrestError · fetch TypeError · 그 외 무엇이든 허용.
 * @param context 카테고리 도메인 사전 검사 결과임을 알리는 선택 힌트.
 * @returns       5종 표준 사용자 메시지 중 하나 (총함수 · 반드시 리턴).
 */
export function mapSupabaseError(err: unknown, context?: ErrorContext): MappedError {
  // 원문 오류는 콘솔에만 남기고 UI에는 절대 흘려보내지 않는다.
  console.error('[mapSupabaseError]', err);

  // 1. 카테고리 참조 존재 (프론트 사전 검사에서 확정된 결과)
  if (context === 'category_reference') {
    return ERR_CATEGORY_REF;
  }

  const errObj = typeof err === 'object' && err !== null ? (err as MaybeSupabaseError) : null;
  const code = readString(errObj?.code);

  // 2. 카테고리 중복 — 명시적 컨텍스트 또는 Postgres unique_violation
  if (context === 'category_duplicate' || code === PG_UNIQUE_VIOLATION) {
    return ERR_CATEGORY_DUP;
  }

  // 3. 네트워크 실패
  if (isNetworkError(err)) {
    return ERR_NETWORK;
  }

  // 4 / 5. HTTP status 로 분기
  const status = readNumber(errObj?.status);
  if (status !== undefined) {
    if (status >= 500 && status < 600) return ERR_TEMPORARY;
    if (status >= 400 && status < 500) return ERR_SAVE_FAILED;
  }

  // fallback — status 정보가 없거나 4xx/5xx 범위 밖인 알 수 없는 실패는
  // 저장 실패로 취급한다(사용자에게는 "저장에 실패했습니다" 안내).
  return ERR_SAVE_FAILED;
}
