import type { ReactNode } from 'react';

/**
 * PageShell
 *
 * 모든 기능 페이지(일정 · 결정사항 · 예산관리 · 여행준비 · 연락처)가 공유하는
 * 섹션 래퍼. DA_WEBUI_KIT.md §7.7 `SlideShell`의 헤더 구조를 이식했다.
 *
 * 헤더 구성(위 → 아래):
 *   1. 번호 배지(`number`) + eyebrow 라벨(`eyebrow`) — 12px uppercase,
 *      tracking 0.18em, `brand-600`. 지도감을 주는 챕터 표기다.
 *   2. 페이지 타이틀 — 24px(모바일)/30px(데스크탑) bold, tracking-tight,
 *      `co-black`.
 *   3. 한 줄 설명(`description`) — 15px, `co-dark-gray`.
 *   4. 우측 정렬 `toolbar` 슬롯 — 보통 PillButton 하나 또는 컨트롤 묶음.
 *
 * 컨테이너는 킷 §9의 본문 규격을 따른다: `max-width: 82rem`, 좌우
 * `24px → 32px → 56px` 반응형 거터, 진입 시 `slideEnter` 애니메이션.
 * `.page-wide`를 넘기면 max-width 제한을 해제해 뷰포트를 가득 쓴다.
 */
export interface PageShellProps {
  title?: string;
  /** 모노스페이스 번호 배지(예: "01"). eyebrow 좌측에 렌더된다. */
  number?: string;
  /** 타이틀 위 uppercase 라벨. */
  eyebrow?: string;
  /** 타이틀 아래 한 줄 설명. */
  description?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageShell({
  title,
  number,
  eyebrow,
  description,
  toolbar,
  children,
  className,
}: PageShellProps) {
  const composed = className ? `page ${className}` : 'page';
  const hasEyebrow = Boolean(number || eyebrow);

  return (
    <section className={composed}>
      {title && (
        <header className="page-header">
          <div className="page-heading">
            {hasEyebrow && (
              <div className="page-eyebrow">
                {number && (
                  <span className="page-number" aria-hidden="true">
                    {number}
                  </span>
                )}
                {eyebrow && <span>{eyebrow}</span>}
              </div>
            )}
            <h1 className="page-title">{title}</h1>
            {description && <p className="page-description">{description}</p>}
          </div>
          {toolbar && <div className="page-toolbar">{toolbar}</div>}
        </header>
      )}
      <div className="page-body">{children}</div>
    </section>
  );
}
