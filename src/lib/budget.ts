/**
 * Budget calculation pure functions.
 *
 * Reference: design.md § Budget_Manager · BudgetSummary
 * - `TOTAL_BUDGET` is fixed at 40,000,000 KRW (Requirement 7.2).
 * - `totalSpent` treats null `Wed_amount` as 0 in the arithmetic sum
 *   (Requirements 7.3, 7.6).
 * - `remainingBudget` satisfies `TOTAL_BUDGET - totalSpent(items)`
 *   (Requirements 7.4, 7.5).
 * - `groupByCategory` partitions items by their `Wed_category` value while
 *   preserving relative order within each group (Requirement 5.1).
 */

export const TOTAL_BUDGET = 40_000_000 as const;

/**
 * 결제자 목록. 예산 항목 폼의 결제자 드롭다운 선택지이자, 요약 카드에서
 * 1인당 지출을 분할 집계하는 순서의 기준이다. 두 곳이 어긋나지 않도록
 * 이 상수 하나만 참조한다.
 */
export const PAYERS = ['혜민', '운석'] as const;

export type Payer = (typeof PAYERS)[number];

/**
 * Sums the `Wed_amount` of every item, replacing `null` with 0.
 *
 * Validates: Requirements 7.3, 7.6
 */
export function totalSpent(items: { Wed_amount: number | null }[]): number {
  let sum = 0;
  for (const it of items) {
    sum += it.Wed_amount ?? 0;
  }
  return sum;
}

/**
 * Returns the remaining budget: `TOTAL_BUDGET - totalSpent(items)`.
 *
 * Validates: Requirements 7.2, 7.4, 7.5
 */
export function remainingBudget(items: { Wed_amount: number | null }[]): number {
  return TOTAL_BUDGET - totalSpent(items);
}

/**
 * 특정 결제자가 부담한 금액의 합. `Wed_payer`가 정확히 일치하는 항목만
 * 합산하며 `Wed_amount`가 null이면 0으로 취급한다(`totalSpent`와 동일 규칙).
 *
 * 불변식: 모든 결제자에 대한 `spentByPayer`의 합 + `spentUnassigned` ===
 * `totalSpent`. 즉 분할 집계가 총 지출을 정확히 분해한다.
 */
export function spentByPayer(
  items: { Wed_amount: number | null; Wed_payer: string | null }[],
  payer: string,
): number {
  let sum = 0;
  for (const it of items) {
    if (it.Wed_payer === payer) sum += it.Wed_amount ?? 0;
  }
  return sum;
}

/**
 * 결제자가 지정되지 않은(또는 `PAYERS`에 없는 값을 가진) 항목의 금액 합.
 *
 * 이 값이 0보다 크면 결제자별 합계만으로는 총 지출이 설명되지 않으므로,
 * 요약 카드가 "미지정" 행을 함께 노출해 숫자가 맞아떨어지게 한다.
 */
export function spentUnassigned(
  items: { Wed_amount: number | null; Wed_payer: string | null }[],
): number {
  let sum = 0;
  for (const it of items) {
    const known = it.Wed_payer !== null && (PAYERS as readonly string[]).includes(it.Wed_payer);
    if (!known) sum += it.Wed_amount ?? 0;
  }
  return sum;
}

/**
 * Groups items by their `Wed_category` value.
 *
 * Invariants (Property 13):
 * - (a) The concatenation of all group arrays is a permutation of `items`
 *   (no loss or duplication).
 * - (b) Every item in `result[k]` satisfies `Wed_category === k`.
 * - (c) The key set equals the distinct set of `Wed_category` values in `items`.
 *
 * Insertion order within each group follows the input array order.
 *
 * Validates: Requirements 5.1
 */
export function groupByCategory<T extends { Wed_category: string }>(
  items: T[],
): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const it of items) {
    const key = it.Wed_category;
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = [];
    }
    result[key].push(it);
  }
  return result;
}
