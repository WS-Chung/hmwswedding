import { useState } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * SideNavigation
 *
 * The always-visible left rail defined by Requirement 1.1: a fixed sidebar that
 * exposes the four page entry points (일정 / 결정사항 / 예산관리 / 연락처) on
 * every screen. Powered by react-router-dom's `<NavLink>` so the active-route
 * class is managed automatically — satisfying Requirement 1.3's "현재 페이지를
 * 시각적으로 활성 상태로 표시" clause without page-level bookkeeping.
 *
 * Layout / styling contract (see .side-navigation rules in global.css):
 *  - Fixed to the left edge, 240px wide, spans the full viewport height.
 *  - Background uses --canvas-parchment (#f5f5f7) with a 1px --hairline
 *    right border, giving the app the same parchment/canvas split the design
 *    tokens define.
 *  - "Wedding Planner" heading at the top uses the display-md typography
 *    tokens, matching the page-title treatment used inside PageShell.
 *  - Each link gets a `.side-nav-link` class; NavLink automatically appends
 *    `active` on the entry whose `to` matches the current route (`end` on the
 *    "일정" root link so `/decision`, `/budget`, `/contact` do not keep it
 *    highlighted).
 *  - The active state is rendered two ways for redundancy: the label picks up
 *    `color: var(--primary)` and a 4px primary indicator bar renders on the
 *    left edge via `::before` — the design brief for this task calls for
 *    "primary color 또는 좌측 인디케이터 바".
 *
 * The `<main>` content area's `margin-left: 240px` is App.tsx's concern
 * (Task 9.2); this component only takes responsibility for the sidebar
 * itself.
 */

interface NavItem {
  to: string;
  label: string;
  /**
   * NavLink's `end` prop restricts active matching to an exact path. The
   * "일정" route lives at `/` so without `end` it would stay active on every
   * child route.
   */
  end?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/',        label: '일정',     end: true },
  { to: '/decision', label: '결정사항' },
  { to: '/budget',   label: '예산관리' },
  { to: '/contact',  label: '연락처' },
] as const;

export function SideNavigation() {
  /**
   * 모바일(≤768px) 전용 슬라이드바 열림 상태. 데스크탑에서는 CSS가 사이드바를
   * 항상 표시하므로 이 값은 무시된다(햄버거 버튼도 CSS로 숨겨진다).
   */
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  return (
    <>
      {/* 모바일 좌상단 햄버거 토글. 데스크탑에서는 display:none. */}
      <button
        type="button"
        className="nav-hamburger"
        aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span aria-hidden="true">{isOpen ? '✕' : '☰'}</span>
      </button>

      {/* 슬라이드바가 열려 있을 때 뒤 콘텐츠를 덮는 오버레이(터치 시 닫힘). */}
      {isOpen && (
        <div className="nav-overlay" onClick={close} aria-hidden="true" />
      )}

      <nav
        className={isOpen ? 'side-navigation open' : 'side-navigation'}
        aria-label="주 메뉴"
      >
        <h1 className="side-nav-title">결혼준비</h1>
        <ul className="side-nav-links" role="list">
          {NAV_ITEMS.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                onClick={close}
                className={({ isActive }) =>
                  isActive ? 'side-nav-link active' : 'side-nav-link'
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
