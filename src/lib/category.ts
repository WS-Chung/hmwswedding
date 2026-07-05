// Wed_Budget_Category validation helpers.
//
// These pure functions gate the Category_Manager's Add and Delete flows on
// the frontend (design.md § Category_Manager):
//
//   - canAddCategory:    duplicate-name rejection before INSERT
//   - canDeleteCategory: reference-existence rejection before DELETE
//
// The two functions use DIFFERENT equality rules by design:
//
//   - canAddCategory  → trim + case-sensitive equality
//     design.md § Category_Manager · 추가: "동일 이름이 이미 존재하면 …
//     대소문자·공백은 trim + 원문 비교." Both the incoming candidate and
//     each existing name are trimmed before comparison so user-typed input
//     with stray whitespace still detects a duplicate against the master
//     set (Requirement 6.6, Property 10).
//
//   - canDeleteCategory → raw case-sensitive `===` equality (no trim)
//     design.md § Category_Manager · 삭제: "`Wed_Budget_Item`에서
//     `Wed_category = <name>`인 행 count를 먼저 조회." This mirrors the
//     Postgres text equality that the DB reference check would perform.
//     Property 11 states: canDeleteCategory(I, c) is true iff every item
//     in I satisfies `item.Wed_category !== c` (strict inequality). The
//     category name passed in is expected to come from the master set,
//     not free user input, so no trimming is applied (Requirement 6.7,
//     Property 11).
//
// Neither function enforces "non-empty name" — that is a form-level
// concern (disable Save when the name field is blank). Property 10's
// biconditional (`true ⟺ n ∉ C`) would be violated by an extra
// empty-input gate here, so it is intentionally omitted.

/** Trim leading/trailing whitespace only — no case folding, no NF*C. */
function trim(name: string): string {
  return name.trim();
}

/**
 * Returns `true` if and only if `name` is not already present in
 * `existing`, where equality is defined as case-sensitive comparison of
 * the trimmed values (design.md § Category_Manager · 추가).
 *
 * @param existing  Current category names — either an array or a Set.
 *                  Each entry is trimmed before comparison so freshly
 *                  loaded DB values and user-typed input are compared on
 *                  equal footing.
 * @param name      Candidate new category name (trimmed before compare).
 * @returns         `true` when the category can be added (no duplicate),
 *                  `false` when a matching trimmed name already exists.
 *
 * Validates: Requirements 6.6 (Property 10).
 */
export function canAddCategory(
  existing: readonly string[] | ReadonlySet<string>,
  name: string,
): boolean {
  const target = trim(name);
  for (const candidate of existing) {
    if (trim(candidate) === target) {
      return false;
    }
  }
  return true;
}

/**
 * Returns `true` if and only if no item in `items` references
 * `categoryName` via its `Wed_category` field, under strict `===`
 * case-sensitive equality (no trimming — mirrors the Postgres equality
 * described in design.md § Category_Manager · 삭제).
 *
 * @param items         Budget_Item records — only the `Wed_category`
 *                      field is inspected.
 * @param categoryName  Name of the category proposed for deletion.
 * @returns             `true` when the category can be deleted (no
 *                      references remain), `false` when at least one
 *                      Budget_Item still points at it.
 *
 * Validates: Requirements 6.7 (Property 11).
 */
export function canDeleteCategory(
  items: readonly { Wed_category: string }[],
  categoryName: string,
): boolean {
  for (const item of items) {
    if (item.Wed_category === categoryName) {
      return false;
    }
  }
  return true;
}
