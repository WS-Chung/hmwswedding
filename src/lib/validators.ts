/**
 * Pure validation helpers for Wedding_Planner.
 *
 * All functions are total, deterministic, and free of side effects.
 *
 * Requirements covered:
 * - 4.4, 4.5: Budget_Password 정확 일치 판정
 * - 5.9:      결제금액 = 0 이상 정수
 * - 8.6:      이메일 = "@" 존재 + 그 뒤 "." 존재
 */

/** Budget_Auth 게이트가 요구하는 고정 비밀번호 문자열. */
export const BUDGET_PASSWORD = '0329' as const;

/**
 * 사용자가 입력한 값이 Budget_Password와 완전히 일치하는지 판정한다.
 *
 * 실패 판정은 사이드 이펙트를 남기지 않으며 (Requirement 4.6) 재시도 잠금·차단 로직도
 * 이 함수에 포함되지 않는다. 어떤 실패 시퀀스에 대해서도 동일하게 boolean만 반환한다.
 *
 * @param input 사용자 입력 문자열
 * @returns `input === BUDGET_PASSWORD`
 */
export function checkBudgetPassword(input: string): boolean {
  return input === BUDGET_PASSWORD;
}

/**
 * 결제금액(Wed_amount)이 저장 가능한 값인지 판정한다.
 *
 * 유효 조건: JavaScript 정수 타입이며 `>= 0` 이다. NaN, Infinity, 소수, 음수, 문자열,
 * null, undefined 등은 모두 false 이다.
 *
 * @param x 검사 대상 값
 * @returns `x`가 0 이상의 안전 정수인 경우에만 true
 */
export function isValidAmount(x: unknown): x is number {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0;
}

/**
 * 이메일 입력값이 저장 게이트를 통과할 수 있는지 판정한다.
 *
 * 판정 규칙(Requirement 8.6):
 * - 문자열 내에 `@` 문자가 최소 1개 존재한다.
 * - 마지막 `@` 위치보다 뒤에 `.` 문자가 최소 1개 더 존재한다.
 *
 * 빈 문자열의 처리(Requirement 8.6의 "이메일 필드에 값을 입력한 경우"에만 검사)는
 * 호출부의 책임이다. 이 함수 자체는 빈 문자열에 대해 false를 반환한다.
 *
 * @param x 검사 대상 문자열
 * @returns 이메일 규칙을 만족하면 true
 */
export function isValidEmail(x: string): boolean {
  const at = x.lastIndexOf('@');
  if (at < 0) return false;
  const dot = x.indexOf('.', at + 1);
  return dot > at;
}
