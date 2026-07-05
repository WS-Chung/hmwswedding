/**
 * Schedule 정렬 유틸리티.
 *
 * Reference: design.md § Schedule_Manager, requirements.md § Requirement 2 · 2.1
 *
 * `Wed_date`는 ISO 8601 date 문자열(`YYYY-MM-DD`)이므로 사전(lexicographic)
 * 비교가 곧 시간순(chronological) 비교와 일치한다. 별도 Date 객체 생성 없이
 * 문자열 비교만으로 오름차순 정렬을 얻을 수 있다.
 *
 * ES2019부터 `Array.prototype.sort`는 stable 정렬이 보장되므로, 동일한
 * `Wed_date`를 가진 원소들의 상대 순서는 입력 순서를 그대로 유지한다.
 */

/**
 * Schedule_Record 배열을 `Wed_date` 오름차순으로 정렬한 **새 배열**을 반환한다.
 *
 * 불변식(Property 12):
 * - (a) 결과 배열의 인접한 두 원소 `(a, b)`에 대해 `a.Wed_date <= b.Wed_date`.
 * - (b) 결과 배열은 입력 배열의 permutation(원소 유실·중복 없음).
 * - (c) 동일한 `Wed_date`를 가진 원소들의 상대 순서는 입력 순서를 유지한다(stable).
 * - (d) 입력 배열 자체는 수정하지 않는다.
 *
 * @param records 정렬 대상 Schedule_Record 배열 — `Wed_date` 필드만 참조한다.
 * @returns       `Wed_date` 오름차순으로 정렬된 새 배열.
 *
 * Validates: Requirements 2.1
 */
export function sortByDate<T extends { Wed_date: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    if (a.Wed_date < b.Wed_date) return -1;
    if (a.Wed_date > b.Wed_date) return 1;
    return 0;
  });
}
