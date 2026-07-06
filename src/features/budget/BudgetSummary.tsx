// features/budget/BudgetSummary.tsx
//
// Budget_Manager 페이지 상단 요약 카드(3-column) 컴포넌트.
//
// 세 셀(총 예산 / 총 지출 / 잔여 예산)에 각각 라벨과 값을 렌더링한다.
// - 총 예산: `TOTAL_BUDGET` 상수 (40,000,000원, Requirement 7.2)
// - 총 지출: `totalSpent(items)` — null 금액은 0으로 취급한 산술 합
//           (Requirements 7.3, 7.6)
// - 잔여 예산: `remainingBudget(items)` — `TOTAL_BUDGET - totalSpent(items)`
//           (Requirement 7.4)
//
// 세 값은 모두 `formatKRW`로 세 자리마다 쉼표를 찍어 원 단위 정수로
// 표시한다(Requirement 7.7). 값 뒤에는 `"원"` 단위 접미어를 붙여
// 요약 셀 하나만으로도 통화 문맥이 즉시 읽힌다.
//
// 렌더링 계약(Requirement 7.1): 세 라벨과 세 값은 항상 함께 표시된다.
// 부모(BudgetPage)가 mutation 성공 후 items를 refetch하면 파생 값이
// 자동 재계산되어 화면에 반영된다(Requirement 7.5).
//
// Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.7

import { TOTAL_BUDGET, totalSpent, remainingBudget } from '../../lib/budget';
import { formatKRW } from '../../lib/format';
import type { BudgetItem } from './budgetApi';

export type BudgetSummaryProps = {
  /** 현재 페이지가 보유한 Budget_Item 목록. `Wed_amount`만 참조된다. */
  items: BudgetItem[];
};

/**
 * 총 예산 · 총 지출 · 잔여 예산 세 값을 카드 3-column으로 표시한다.
 *
 * 순수 프레젠테이션 컴포넌트 — 데이터 페칭·상태 관리 없음.
 */
export function BudgetSummary({ items }: BudgetSummaryProps) {
  return (
    <div className="budget-summary">
      <div className="budget-summary-cell">
        <div className="budget-summary-label">총 예산</div>
        <div className="budget-summary-value">{formatKRW(TOTAL_BUDGET)}원</div>
      </div>
      <div className="budget-summary-cell">
        <div className="budget-summary-label">총 지출</div>
        <div className="budget-summary-value">{formatKRW(totalSpent(items))}원</div>
      </div>
      <div className="budget-summary-cell">
        <div className="budget-summary-label">잔여 예산</div>
        <div className="budget-summary-value">{formatKRW(remainingBudget(items))}원</div>
      </div>
    </div>
  );
}
