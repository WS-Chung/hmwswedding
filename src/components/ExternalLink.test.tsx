/**
 * Unit tests for <ExternalLink /> (Task 8.4).
 *
 * Focus:
 *  - Structural contract used by Decision_Manager and validated more
 *    exhaustively by Property 15 in task 11.3:
 *      · exactly one <a> element is rendered
 *      · `href` is passed through verbatim
 *      · `target="_blank"` is always set
 *      · `rel` contains BOTH "noopener" AND "noreferrer"
 *  - Default-child fallback: when `children` is omitted, the visible text
 *    equals the `href` (design.md § Decision_Manager usage).
 *  - `className` pass-through so consumers can compose layout utilities.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import { ExternalLink } from './ExternalLink';

describe('ExternalLink', () => {
  it('renders exactly one <a> with href, target="_blank", and rel including noopener + noreferrer', () => {
    const url = 'https://example.com/venue';
    const { container } = render(<ExternalLink href={url}>웨딩홀 링크</ExternalLink>);

    const anchors = container.querySelectorAll('a');
    expect(anchors).toHaveLength(1);

    const link = screen.getByRole('link', { name: '웨딩홀 링크' }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe(url);
    expect(link.getAttribute('target')).toBe('_blank');

    const rel = link.getAttribute('rel') ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');
  });

  it('falls back to the href as visible text when children is omitted', () => {
    const url = 'https://example.com/decision/123';
    render(<ExternalLink href={url} />);

    const link = screen.getByRole('link', { name: url }) as HTMLAnchorElement;
    expect(link).toHaveTextContent(url);
    expect(link.getAttribute('href')).toBe(url);
  });

  it('passes className through to the anchor element', () => {
    render(
      <ExternalLink href="https://example.com" className="decision-link">
        열기
      </ExternalLink>,
    );
    const link = screen.getByRole('link', { name: '열기' });
    expect(link).toHaveClass('decision-link');
  });
});
