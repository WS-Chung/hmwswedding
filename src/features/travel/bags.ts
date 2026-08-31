/**
 * 여행준비 페이지의 수하물(가방) 분류 마스터.
 *
 * 페이지는 정확히 4개의 카드로 2열 × 2행 그리드를 이룬다.
 *   좌상: 혜민 캐리어     우상: 운석 캐리어
 *   좌하: 혜민 기내가방   우하: 운석 기내가방
 * 네 카드의 좌우 폭과 상하 높이는 모두 동일하다.
 *
 * DB에는 `Wed_Travel.Wed_bag` 컬럼에 아래 `key` 값이 그대로 저장된다.
 * 표시 라벨(`title`)은 앱에서만 관리하므로 문구를 바꿔도 마이그레이션이
 * 필요하지 않다. 반대로 `key`는 저장값이므로 변경 시 UPDATE가 필요하다.
 */

/** `Wed_bag`에 저장되는 가방 식별자. */
export type BagKey =
  | 'hyemin_carrier'
  | 'hyemin_cabin'
  | 'unseok_carrier'
  | 'unseok_cabin';

/** 수하물 종류 — 캐리어(large) vs 기내가방(small). */
export type BagSize = 'large' | 'small';

export interface BagDefinition {
  key: BagKey;
  /** 카드 타이틀. */
  title: string;
  /**
   * 손잡이·바퀴 데코의 크기 구분. 카드 자체의 폭·높이는 네 장이 모두 같으므로
   * 이 값은 시각적 힌트에만 쓰인다.
   */
  size: BagSize;
  /** 카드 헤더의 모노스페이스 번호 배지(킷 §1 "번호 + 모노 prefix"). */
  number: string;
}

/**
 * 렌더 순서 = 그리드 배치 순서. 2열 × 2행 배치이므로 다음과 같이 놓인다.
 *
 *   좌상: 혜민 캐리어     우상: 운석 캐리어
 *   좌하: 혜민 기내가방   우하: 운석 기내가방
 *
 * 네 카드의 좌우·상하 폭은 모두 동일하다(global.css `.luggage-grid`).
 * `size`는 카드 크기가 아니라 상단 손잡이·바퀴 데코의 크기 차이에만 쓰인다.
 */
export const BAGS: readonly BagDefinition[] = [
  { key: 'hyemin_carrier', title: '혜민 캐리어',   size: 'large', number: '01' },
  { key: 'unseok_carrier', title: '운석 캐리어',   size: 'large', number: '02' },
  { key: 'hyemin_cabin',   title: '혜민 기내가방', size: 'small', number: '03' },
  { key: 'unseok_cabin',   title: '운석 기내가방', size: 'small', number: '04' },
] as const;

/**
 * `Wed_bag` 컬럼의 DB 기본값. 컬럼 추가 마이그레이션 시점에 이미 존재했던
 * 행들은 모두 이 값을 갖게 되므로(=혜민 캐리어 카드에 표시된다) 기존 데이터가
 * 화면에서 사라지지 않는다.
 */
export const DEFAULT_BAG: BagKey = 'hyemin_carrier';

/** 알려진 가방 키인지 판정한다. */
export function isBagKey(value: unknown): value is BagKey {
  return BAGS.some((b) => b.key === value);
}

/** 가방 키 → 표시 라벨. 알 수 없는 키는 키 문자열을 그대로 돌려준다. */
export function bagTitle(key: string): string {
  return BAGS.find((b) => b.key === key)?.title ?? key;
}
