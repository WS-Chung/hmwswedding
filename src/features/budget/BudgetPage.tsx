// features/budget/BudgetPage.tsx
//
// Budget_Manager 페이지의 최상위 조립 컴포넌트.
//
// 구조(design.md § Budget_Manager 컴포넌트 트리):
//
//   BudgetPage
//   └─ BudgetAuthProvider                      ── 세션 인증 플래그 컨텍스트
//      └─ BudgetAuthGate                       ── Requirement 4.1 게이트
//         └─ BudgetPageInner                   ── 실제 예산관리 콘텐츠
//            ├─ PageShell (title: "예산관리")
//            │  └─ toolbar: "카테고리 관리" PillButton
//            ├─ InlineError (배너, mutation 실패 표준 메시지)
//            ├─ BudgetSummary(items)
//            ├─ BudgetItemTable(items, categories, onMutate, onError)
//            └─ CategoryManagerModal(isOpen, onClose, onCategoriesChanged, items)
//
// 이 페이지는 다음 역할만 담당한다.
//   1) `Wed_Budget_Item` · `Wed_Budget_Category` 두 목록을 함께 fetch/refetch.
//   2) 하위 컴포넌트가 mutation 성공 시 호출하는 `refetch()`를 제공.
//   3) 실패 메시지를 상단 InlineError로 라우팅(design.md § 오류 처리 원칙).
//   4) "카테고리 관리" 트리거로 `CategoryManagerModal` 오픈/클로즈.
//
// 파생 값(Total_Spent, Remaining_Budget)은 `BudgetSummary`가 순수 함수로
// 자동 재계산하므로(Requirement 7.5), 여기서는 refetch 이후 items state를
// 갱신하기만 하면 요약 셀이 즉시 새 값으로 다시 렌더된다.
//
// 카테고리 이름 리스트는 `BudgetItemTable`의 <Select> 옵션과 authoritative
// 집합이 되어야 한다(Requirements 5.6, 6.8 — Property 9). 이 페이지에서
// `useMemo`로 `categories.map(c => c.Wed_name)`을 계산해 자식에게 주입하고,
// `CategoryManagerModal`의 성공 콜백에서 동일한 `refetch`를 호출해 두 개의
// 로컬 state(items, categories)를 동기화한다.
//
// BudgetAuthProvider를 BudgetPage 내부에서 감싸는 이유:
//   `BudgetAuthGate`는 `useBudgetAuth()`를 통해 컨텍스트를 소비하므로 반드시
//   `BudgetAuthProvider` 하위에서 렌더링되어야 한다. Task 9.2에서 App.tsx가
//   완성되기 전이라도 이 페이지가 자기완결적으로 동작할 수 있도록 Provider를
//   페이지 경계에서 포함한다(design.md § Provider 배치 규칙과 정합).
//
// Validates: Requirements 4.1, 4.4, 6.8, 7.5

import { useCallback, useEffect, useMemo, useState } from 'react';

import { BudgetAuthProvider } from './BudgetAuthContext';
import { BudgetAuthGate } from './BudgetAuthGate';
import { BudgetSummary } from './BudgetSummary';
import { BudgetItemTable } from './BudgetItemTable';
import { CategoryManagerModal } from './CategoryManagerModal';
import { budgetApi } from './budgetApi';
import type { BudgetItem } from './budgetApi';
import { categoryApi } from './categoryApi';
import type { BudgetCategory } from './categoryApi';

import { PageShell } from '../../components/PageShell';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';

/**
 * 페이지 조립의 외곽. 인증 컨텍스트 → 인증 게이트 → 실제 콘텐츠 순으로
 * 트리를 세워 인증 상태가 갱신되면 게이트가 자연스럽게 children으로
 * 전환된다(Requirement 4.1, 4.4).
 */
export function BudgetPage() {
  return (
    <BudgetAuthProvider>
      <BudgetAuthGate>
        <BudgetPageInner />
      </BudgetAuthGate>
    </BudgetAuthProvider>
  );
}

/**
 * 인증 통과 이후에만 마운트되는 실제 예산관리 화면.
 *
 * 두 개의 서버 목록(`items`, `categories`)을 로컬 state로 소유하며,
 * `refetch()`를 자식들에게 위임한다. 자식은 mutation 성공 후 이 콜백을
 * 호출해 페이지 전체를 최신 상태로 재동기화한다.
 */
function BudgetPageInner() {
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showCatMgr, setShowCatMgr] = useState<boolean>(false);

  /**
   * items · categories를 동시에 재조회한다.
   *
   * 두 요청은 서로 독립적이므로 `Promise.all`로 병렬 실행해 초기 로드
   * latency를 최소화한다. 어느 한쪽이라도 실패하면 표준화된 사용자 메시지
   * (mapSupabaseError가 5종 중 하나로 사상해 준 문구)를 상단 배너에
   * 노출하고, 로컬 state는 이전 값을 그대로 유지한다(Property 17).
   *
   * 성공 경로에서는 errorMsg를 null로 리셋해 이전 실패 메시지가 화면에
   * 남지 않도록 한다.
   */
  const refetch = useCallback(async () => {
    try {
      const [it, cat] = await Promise.all([budgetApi.list(), categoryApi.list()]);
      setItems(it);
      setCategories(cat);
      setErrorMsg(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '요청을 처리할 수 없습니다.');
    }
  }, []);

  // 초기 마운트 시 한 번, 그리고 refetch identity가 바뀔 때(useCallback으로
  // 안정적이므로 실질적으로 최초 1회) 데이터를 로드한다.
  useEffect(() => {
    void refetch();
  }, [refetch]);

  /**
   * BudgetItemTable의 <Select> 옵션 집합. 카테고리 마스터 이름만 추려
   * 자식이 자기 편에서 map을 다시 돌지 않아도 되도록 미리 계산한다.
   * `categories`가 재조회로 새 참조를 받으면 이 배열도 재계산되고 자식의
   * <Select>가 새 옵션 집합을 즉시 반영한다(Property 9 · Requirement 6.8).
   */
  const categoryNames = useMemo<string[]>(
    () => categories.map((c) => c.Wed_name),
    [categories],
  );

  return (
    <PageShell
      title="예산관리"
      toolbar={
        <PillButton variant="secondary" onClick={() => setShowCatMgr(true)}>
          카테고리 관리
        </PillButton>
      }
    >
      <InlineError>{errorMsg}</InlineError>
      <BudgetSummary items={items} />
      <BudgetItemTable
        items={items}
        categories={categoryNames}
        onMutate={refetch}
        onError={setErrorMsg}
      />
      <CategoryManagerModal
        isOpen={showCatMgr}
        onClose={() => setShowCatMgr(false)}
        onCategoriesChanged={refetch}
        items={items}
      />
    </PageShell>
  );
}

export default BudgetPage;
