import type { ReactNode } from 'react';

/**
 * PageShell
 *
 * The section-level wrapper every feature page (Schedule · Decision · Budget ·
 * Contact) uses to enforce the shared visual rhythm defined in the design
 * tokens. Renders a `<section class="page">` with 80px vertical breathing room
 * (`--space-section`) and 48px horizontal gutters (`--space-xxl`), centered
 * within a 1200px max-width column.
 *
 * When `title` is provided, an optional header row renders with the page title
 * on the left and a caller-supplied `toolbar` (typically a PillButton or a
 * cluster of controls) pushed to the right. The body region is a vertical
 * flex column so children with `gap: var(--space-xl)` alignment fall into
 * place without extra wrappers.
 *
 * Requirement 10.6: `.page` applies `padding: var(--space-section) …` so the
 * 80px top/bottom rhythm is honored on every page consistently.
 */
export interface PageShellProps {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PageShell({
  title,
  toolbar,
  children,
  className,
}: PageShellProps) {
  const composed = className ? `page ${className}` : 'page';
  return (
    <section className={composed}>
      {title && (
        <header className="page-header">
          <h1 className="page-title">{title}</h1>
          {toolbar && <div className="page-toolbar">{toolbar}</div>}
        </header>
      )}
      <div className="page-body">{children}</div>
    </section>
  );
}
