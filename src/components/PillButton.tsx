import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

/**
 * PillButton
 *
 * The single primary/secondary CTA button used across all pages
 * (저장 · 추가 · 확인 · 취소 · 월 이동 등). Wraps a native `<button>` and applies
 * either the `.pill-primary` (Action Blue fill) or `.pill-secondary`
 * (outlined) preset defined in src/styles/global.css.
 *
 * DA_WEBUI_KIT.md §7.16 버튼 위계 매핑:
 *   - `variant="primary"`   → L1 Primary   (`.pill-primary`, bg brand-600 + shadow-glow)
 *   - `variant="secondary"` → L2 Emphasized (`.pill-secondary`, bg brand-50 + ring brand-500/40)
 * 두 변형 모두 `border-radius: var(--radius-pill)`(9999px) 캡슐 형태다.
 * 위계 룰: 한 화면에서 L1은 1개, L2는 1~2개를 권장한다.
 *
 * Defaults:
 *  - `variant` defaults to 'primary'.
 *  - `type` defaults to 'button' so accidental form submission is opt-in.
 *
 * Additional `className` values are appended after the variant class so
 * callers can add layout adjustments (e.g. margin/full-width utilities) without
 * losing the pill preset.
 */
export type PillButtonVariant = 'primary' | 'secondary';

export interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PillButtonVariant;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  function PillButton(
    { variant = 'primary', className, type = 'button', children, ...rest },
    ref,
  ) {
    const base = variant === 'primary' ? 'pill-primary' : 'pill-secondary';
    const composed = className ? `${base} ${className}` : base;
    return (
      <button ref={ref} type={type} className={composed} {...rest}>
        {children}
      </button>
    );
  },
);
