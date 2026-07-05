/**
 * Currency formatting utilities for the wedding planner budget module.
 *
 * Per Requirement 7.7, 총 예산 / 총 지출 / 잔여 예산 값은 원 단위 정수로 표시하며
 * 세 자리마다 쉼표로 자릿수를 구분한다.
 */

/**
 * Format a number as a Korean Won (KRW) integer string with three-digit
 * comma grouping.
 *
 * The fractional part is truncated toward zero so the output never contains a
 * decimal point, even if a caller accidentally passes a non-integer. This
 * guarantees the result always matches the pattern
 * `/^-?(0|[1-9]\d{0,2}(,\d{3})*)$/` for finite numbers.
 *
 * Examples:
 *   formatKRW(0)          -> "0"
 *   formatKRW(999)        -> "999"
 *   formatKRW(1000)       -> "1,000"
 *   formatKRW(60_000_000) -> "60,000,000"
 *
 * @param n - Amount in KRW. Expected to be a non-negative integer per the
 *            budget domain, though negatives are formatted consistently.
 * @returns Comma-separated integer string.
 */
export function formatKRW(n: number): string {
  const intValue = Math.trunc(n);
  return intValue.toLocaleString('en-US');
}
