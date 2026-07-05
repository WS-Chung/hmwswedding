/**
 * Calendar pure utilities for the Schedule_Manager.
 *
 * Reference: design.md § Schedule_Manager · 날짜 유틸 (`lib/calendar.ts`).
 *
 * Exports:
 *   - DEFAULT_MONTH          — 앱 최초 진입 시 달력 초기 표시 월 (Requirement 2.2)
 *   - shiftMonth             — 월 ±1 이동, 12→1 / 1→12 시 연도 이월 (Requirement 2.3)
 *   - monthGridDays          — 7의 배수 길이 달력 grid; leading/trailing 셀은
 *                              이전/다음 달에서 채워 `inMonth: false` 로 표시
 *   - computeHighlightedDates — 해당 (year, month)에 속하는 Wed_date 문자열의
 *                              distinct 집합 (Requirements 2.4, 2.5; Property 20)
 *
 * 모든 함수는 순수 함수이며, `Date.UTC`를 통해 UTC 기준으로만 계산하여
 * 로컬 타임존에 의존하지 않는다.
 */

/** ISO 날짜 문자열 형식 `YYYY-MM-DD` (month/day zero-padded). */
type IsoDate = string;

/** Sunday(0) ~ Saturday(6) — JS Date.getDay() 규약과 동일. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** `year`는 4자리 그레고리력 연도, `month`는 1..12 (1-indexed). */
export type YearMonth = { year: number; month: number };

/** `monthGridDays` 반환 셀. */
export type DayCell = {
  iso: IsoDate;
  inMonth: boolean;
  dayOfWeek: DayOfWeek;
};

/**
 * 앱 최초 진입 시 달력 초기 표시 월.
 *
 * Validates: Requirements 2.2
 */
export const DEFAULT_MONTH: YearMonth = { year: 2026, month: 7 } as const;

/** 두 자리 zero-padding (0..9 → "00".."09"). */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/**
 * 표시 월을 ±1 이동한다. 월 오버플로 시 연도가 이월된다.
 *
 * - shiftMonth({y, 12}, +1) === {y+1, 1}
 * - shiftMonth({y,  1}, -1) === {y-1, 12}
 * - 그 외에는 month만 delta 만큼 변한다.
 *
 * 입력 객체는 변형되지 않는다(불변).
 *
 * Validates: Requirements 2.3
 */
export function shiftMonth(m: YearMonth, delta: -1 | 1): YearMonth {
  if (delta === 1) {
    return m.month === 12
      ? { year: m.year + 1, month: 1 }
      : { year: m.year, month: m.month + 1 };
  }
  return m.month === 1
    ? { year: m.year - 1, month: 12 }
    : { year: m.year, month: m.month - 1 };
}

/**
 * 해당 (year, month) 달력을 렌더링하기 위한 셀 배열을 반환한다.
 *
 * 규칙:
 *   - 일요일 시작 주(0=Sun..6=Sat).
 *   - 대상 월 1일이 요일 `d`일 때, 앞쪽에 `d`개의 이전 달 leading 셀을 채운다.
 *   - 뒤쪽 trailing 셀은 결과 길이가 7의 배수가 되도록 다음 달에서 채운다.
 *   - leading/trailing 셀은 `inMonth: false`, 대상 월 셀만 `inMonth: true`.
 *   - `iso`는 항상 "YYYY-MM-DD" 형식(month/day zero-padded).
 *   - `dayOfWeek`는 JS Date.getUTCDay() 값과 동일하며 인덱스별로 0→6→0→6... 순환한다.
 *
 * UTC 기준으로 계산하므로 클라이언트 로컬 타임존과 무관하게 동일한 결과를 낸다.
 *
 * Validates: Requirements 2.3
 */
export function monthGridDays(year: number, month: number): DayCell[] {
  // 대상 월 1일 (UTC).
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const leading = firstOfMonth.getUTCDay(); // 0..6, Sun-start

  // 대상 월의 총 일수: 다음 달 "0일" == 이번 달 마지막 날.
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const beforePad = leading + daysInMonth;
  const trailing = (7 - (beforePad % 7)) % 7;
  const total = beforePad + trailing;

  const cells: DayCell[] = [];
  for (let i = 0; i < total; i++) {
    // i === leading 인 지점이 대상 월 1일. leading보다 작으면 음수/0 → 이전 달로,
    // 크면 daysInMonth 초과 → 다음 달로 Date.UTC가 자동 정규화한다.
    const dayOffset = i - leading + 1;
    const d = new Date(Date.UTC(year, month - 1, dayOffset));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    cells.push({
      iso: `${y}-${pad2(m)}-${pad2(day)}`,
      inMonth: y === year && m === month,
      dayOfWeek: d.getUTCDay() as DayOfWeek,
    });
  }
  return cells;
}

/**
 * `records`의 `Wed_date` 값 중 (year, month)에 속하는 문자열의 distinct 집합.
 *
 * Property 20 (biconditional):
 *   d ∈ result  ⇔  (∃ r ∈ records. r.Wed_date === d) ∧ d가 (year, month) 범위에 속함.
 *
 * 매칭은 "YYYY-MM-" prefix 일치로 판정한다. Postgres DATE 컬럼의 표준 ISO
 * 반환 형식(zero-padded)에 의존하며, Set 반환값의 각 원소는 원본 `Wed_date`
 * 문자열 그대로다. 동일 날짜가 여러 record에 존재해도 Set 특성상 1회만 포함된다.
 *
 * Validates: Requirements 2.4, 2.5 (Property 20)
 */
export function computeHighlightedDates<T extends { Wed_date: string }>(
  records: readonly T[],
  year: number,
  month: number,
): Set<string> {
  const prefix = `${year}-${pad2(month)}-`;
  const result = new Set<string>();
  for (const r of records) {
    if (r.Wed_date.startsWith(prefix)) {
      result.add(r.Wed_date);
    }
  }
  return result;
}
