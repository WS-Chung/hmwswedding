/**
 * 애플리케이션 루트 컴포넌트 (Task 9.2).
 *
 * HashRouter 기반 SPA 셸을 정의한다:
 *   - 좌측: `<SideNavigation />` 고정 사이드바 (컴포넌트 스타일이 `position: fixed`).
 *   - 우측: `<main className="app-main">` 라우트 아웃렛. 사이드바 폭(240px)만큼
 *     `margin-left`로 오프셋되어 겹침을 방지한다 (`global.css`의 `.app-main`).
 *
 * 라우팅 매핑:
 *   - `/`         → SchedulePage         (기본 라우트 · Requirement 1.4)
 *   - `/decision` → DecisionPage
 *   - `/budget`   → BudgetPage           (내부에서 <BudgetAuthGate>로 자기 감싸기 — Task 14.5)
 *   - `/contact`  → ContactPage
 *
 * 인증 컨텍스트(`BudgetAuthProvider`)는 라우터 안쪽·페이지 바깥에서 트리 전체를 감싸
 * 사이드바(활성 항목 표시)든 어떤 페이지든 세션 상태를 안전하게 구독할 수 있게 한다.
 * Provider가 세션 스토리지 플래그(`wed_budget_authed`)를 lazy initializer로 읽으므로
 * 라우트 재진입 시 재인증이 요구되지 않는다 (Requirement 4.7 위임).
 *
 * 요구사항 매핑:
 * - Requirement 1.2: 4개 페이지가 라우팅 아웃렛으로 렌더된다.
 * - Requirement 1.4: 초기 진입 라우트는 SchedulePage.
 * - Requirement 11.3: 정적 자산만 사용하는 HashRouter 기반 SPA 셸 구성.
 */

import { HashRouter, Routes, Route } from 'react-router-dom';
import { SideNavigation } from './components/SideNavigation';
import { SchedulePage } from './features/schedule/SchedulePage';
import { DecisionPage } from './features/decision/DecisionPage';
import { ContactPage } from './features/contact/ContactPage';
import { BudgetPage } from './features/budget/BudgetPage';
import { TravelPage } from './features/travel/TravelPage';
import { BudgetAuthProvider } from './features/budget/BudgetAuthContext';

export function App() {
  return (
    <HashRouter>
      <BudgetAuthProvider>
        <SideNavigation />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<SchedulePage />} />
            <Route path="/decision" element={<DecisionPage />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/travel" element={<TravelPage />} />
            <Route path="/contact" element={<ContactPage />} />
          </Routes>
        </main>
      </BudgetAuthProvider>
    </HashRouter>
  );
}
