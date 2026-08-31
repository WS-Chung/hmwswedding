import { useState } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * SideNavigation
 *
 * 좌측 고정 레일 — DA_WEBUI_KIT.md §6.2 "Sidebar 정확 명세(라이트 표준 v1.0)"를
 * 따른다.
 *
 * 구성(위 → 아래):
 *  1. 로고 블록: 36×36 라운드 12px navy→cyan 그라디언트 마크 + 서비스명 +
 *     서브타이틀. 마크는 순수 데코이므로 aria-hidden.
 *  2. 그룹 라벨: 11px uppercase tracking 0.18em, `--text-meta`.
 *  3. 메뉴 항목: 12px mono 번호 prefix + 15px 라벨.
 *     번호 prefix는 `aria-hidden="true"`로 접근성 이름 계산에서 제외되므로
 *     링크의 accessible name은 라벨 텍스트("일정" 등) 그대로 유지된다.
 *
 * 활성 상태(Requirement 1.3 + 킷 §6.2):
 *  - `brand-50` 그라디언트 배경 + `ring-brand-500/25`
 *  - 좌측 24×3px navy 막대 + cyan 글로우 (`.side-nav-link.active::before`)
 *  - 우측 6×6px cyan 도트 + 글로우 (`.side-nav-link.active::after`)
 *  두 인디케이터를 CSS 의사요소로 처리해 마크업은 링크 텍스트만 유지한다.
 *
 * 모바일(<1024px, 킷 §9의 lg 미만): 사이드바는 화면 밖으로 밀려나고 우하단
 * 고정 navy pill 토글로 열고 닫는다. 오버레이 터치·메뉴 선택 시 닫힌다.
 *
 * `<main>`의 `margin-left: var(--sidebar-width)` 오프셋은 App.tsx/global.css의
 * 책임이며 이 컴포넌트는 레일 자체만 담당한다.
 */

interface NavItem {
  to: string;
  label: string;
  /** 사이드바에 표시되는 모노스페이스 번호 prefix (킷 §1 "번호 + 모노 prefix"). */
  number: string;
  /**
   * NavLink의 `end`는 정확 경로 일치로 활성 판정을 제한한다. "일정" 라우트는
   * `/`이므로 `end`가 없으면 모든 하위 경로에서 활성으로 남는다.
   */
  end?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/',         label: '일정',     number: '01', end: true },
  { to: '/decision', label: '결정사항', number: '02' },
  { to: '/budget',   label: '예산관리', number: '03' },
  { to: '/travel',   label: '여행준비', number: '04' },
  { to: '/contact',  label: '연락처',   number: '05' },
] as const;

export function SideNavigation() {
  /**
   * 모바일(<1024px) 전용 슬라이드바 열림 상태. 데스크탑에서는 CSS가 사이드바를
   * 항상 표시하므로 이 값은 무시된다(토글 버튼도 CSS로 숨겨진다).
   */
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  return (
    <>
      {/* 모바일 우하단 토글. 데스크탑에서는 display:none. */}
      <button
        type="button"
        className="nav-hamburger no-print"
        aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? '닫기 ✕' : '메뉴 ☰'}
      </button>

      {/* 슬라이드바가 열려 있을 때 뒤 콘텐츠를 덮는 오버레이(터치 시 닫힘). */}
      {isOpen && (
        <div className="nav-overlay" onClick={close} aria-hidden="true" />
      )}

      <nav
        className={isOpen ? 'side-navigation open' : 'side-navigation'}
        aria-label="주 메뉴"
      >
        <div className="side-nav-brand">
          <span className="side-nav-mark" aria-hidden="true" />
          <div className="side-nav-brand-text">
            <h1 className="side-nav-title">결혼준비</h1>
            <span className="side-nav-subtitle">Wedding Planner</span>
          </div>
        </div>

        <div>
          <p className="side-nav-group-label">Menu</p>
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
                  <span className="side-nav-num" aria-hidden="true">
                    {item.number}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </>
  );
}
