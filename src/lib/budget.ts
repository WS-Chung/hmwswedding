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
