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
 * Requirement 10.5 (pill 반경): both variants receive `border-radius:
 * var(--rounded-pill)` (9999px) via the shared CSS classes.
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
