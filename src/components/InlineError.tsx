import type { ReactNode } from 'react';

/**
 * InlineError
 *
 * Reusable form-level error slot rendered beneath a field or below a form.
 *
 * Behavior:
 *  - Announces the message with `role="alert"` so assistive tech picks it up.
 *  - Renders NOTHING when `children` is empty/nullish. This lets callers
 *    unconditionally render `<InlineError>{error}</InlineError>` without an
 *    outer ternary; an unset error state does not produce empty markup.
 *  - Visual styling comes from the global `.inline-error` class (caption size,
 *    error-tone color) — see src/styles/global.css.
 *
 * Requirement 10.5 (design tokens): typography and color are pulled from the
 * token layer via the `.inline-error` class rather than inline styles.
 */
export interface InlineErrorProps {
  /** Message body. When empty/null/undefined the component renders null. */
  children?: ReactNode;
  /** Optional id — used by fields for aria-describedby linkage. */
  id?: string;
}

function isEmptyContent(node: ReactNode): boolean {
  if (node === null || node === undefined || node === false) return true;
  if (typeof node === 'string') return node.length === 0;
  if (Array.isArray(node)) return node.length === 0 || node.every(isEmptyContent);
  return false;
}

export function InlineError({ children, id }: InlineErrorProps) {
  if (isEmptyContent(children)) return null;
  return (
    <div id={id} role="alert" className="inline-error">
      {children}
    </div>
  );
}
