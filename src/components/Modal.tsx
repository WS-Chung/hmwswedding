import { useEffect } from 'react';
import type { ReactNode } from 'react';

/**
 * Modal
 *
 * 앱 전체에서 재사용되는 공용 팝업 컴포넌트.
 * 모든 "항목 추가" / "일정 추가" 등 신규 등록 폼은 이 Modal 안에서 렌더된다.
 *
 * 특징:
 *  - `isOpen`이 false면 아무 것도 렌더하지 않는다(오버레이 X).
 *  - Esc 키로 닫을 수 있다(`onClose` 호출).
 *  - `role="dialog" aria-modal="true"`로 스크린리더에 모달임을 알린다.
 *  - `.modal-overlay`는 페이드인, `.modal-card`는 슬라이드/페이드인 애니메이션
 *    (global.css의 `@keyframes modalFadeIn` / `modalSlideIn`).
 *  - `actions` 프롭으로 하단 액션 영역(저장/취소 등)을 우측 정렬로 렌더.
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** 하단 액션 버튼 영역. 없으면 body만 렌더된다. */
  actions?: ReactNode;
  /** 접근성용 aria-label. 미지정 시 `title`을 사용한다. */
  ariaLabel?: string;
}

export function Modal({ isOpen, onClose, title, children, actions, ariaLabel }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={(e) => {
        // 오버레이 자체 클릭 시 닫기 (카드 내부 클릭은 이벤트 버블링 되어 오는데,
        // target이 오버레이 자신일 때만 닫도록 한다).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card">
        <header className="modal-header">
          <h2 className="modal-title">{title}</h2>
        </header>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
