/**
 * Unit tests for <SideNavigation /> (Task 9.1).
 *
 * Focus:
 *  - Structural contract required by Requirement 1.1: four fixed links
 *    labelled "일정", "결정사항", "예산관리", "연락처" rendered in order.
 *  - href routing targets match the App.tsx route table (Task 9.2 wiring
 *    contract): "/", "/decision", "/budget", "/contact".
 *  - Active-state visual cue (Requirement 1.3): the NavLink whose route
 *    matches the current location picks up the `active` class so the
 *    primary color + indicator bar in global.css can render.
 *
 * NavLink depends on Router context, so every render is wrapped in
 * `<MemoryRouter>` with a caller-supplied initial entry.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

import { SideNavigation } from './SideNavigation';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SideNavigation />
    </MemoryRouter>,
  );
}

describe('SideNavigation', () => {
  it('renders four links with the correct labels and hrefs', () => {
    renderAt('/');

    const nav = screen.getByRole('navigation', { name: '주 메뉴' });
    const links = within(nav).getAllByRole('link');

    expect(links).toHaveLength(4);

    // NavLink resolves relative destinations against the current location, so
    // the resulting `href` values are the absolute route paths.
    const [schedule, decision, budget, contact] = links;
    expect(schedule).toHaveTextContent('일정');
    expect(schedule).toHaveAttribute('href', '/');

    expect(decision).toHaveTextContent('결정사항');
    expect(decision).toHaveAttribute('href', '/decision');

    expect(budget).toHaveTextContent('예산관리');
    expect(budget).toHaveAttribute('href', '/budget');

    expect(contact).toHaveTextContent('연락처');
    expect(contact).toHaveAttribute('href', '/contact');
  });

  it('renders the "Wedding Planner" app title heading', () => {
    renderAt('/');
    const heading = screen.getByRole('heading', { level: 1, name: 'Wedding Planner' });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveClass('side-nav-title');
  });

  it('marks only the "일정" link active on the root route', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: '일정' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: '결정사항' })).not.toHaveClass('active');
    expect(screen.getByRole('link', { name: '예산관리' })).not.toHaveClass('active');
    expect(screen.getByRole('link', { name: '연락처' })).not.toHaveClass('active');
  });

  it.each([
    ['/decision', '결정사항'],
    ['/budget',   '예산관리'],
    ['/contact',  '연락처'],
  ])('marks the correct link active for route %s', (path, activeLabel) => {
    renderAt(path);
    const activeLink = screen.getByRole('link', { name: activeLabel });
    expect(activeLink).toHaveClass('active');

    // "일정" (root path) must NOT keep active state on sibling routes; this
    // relies on the `end` prop applied to the "/" NavLink.
    expect(screen.getByRole('link', { name: '일정' })).not.toHaveClass('active');
  });
});
