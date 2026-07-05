import type { ReactNode } from 'react';

/**
 * ExternalLink
 *
 * Renders a single `<a>` element that always opens in a new browsing context
 * with the recommended tab-nabbing protections applied.
 *
 * Usage — Decision_Manager (design.md § 결정사항 렌더링 규칙):
 *   <ExternalLink href={Wed_link}>{Wed_link}</ExternalLink>
 *
 * When `children` is omitted, the raw `href` is used as the visible text so
 * callers can pass the URL exactly once (`<ExternalLink href={url} />`).
 *
 * Visual styling (color + hover underline) is delegated to the global
 * `a { … }` rule in src/styles/global.css, which sets color `var(--primary)`
 * and adds `text-decoration: underline` on `:hover` — satisfying
 * Requirement 3.7 without a component-scoped stylesheet.
 *
 * Contract (validated by Property 15 in task 11.3):
 *  - exactly one `<a>` element is rendered per invocation
 *  - `target="_blank"` is always present
 *  - `rel` contains BOTH "noopener" AND "noreferrer" as a single string
 */
export interface ExternalLinkProps {
  href: string;
  children?: ReactNode;
  className?: string;
}

export function ExternalLink({ href, children, className }: ExternalLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children ?? href}
    </a>
  );
}
