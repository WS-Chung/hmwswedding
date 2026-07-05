// Placeholder smoke test — verifies that the Vitest + jsdom pipeline is wired up.
// Replaced by real unit / property-based tests as tasks in section 2+ land.
import { describe, it, expect } from 'vitest';

describe('test framework smoke', () => {
  it('runs a trivial assertion under jsdom', () => {
    expect(1 + 1).toBe(2);
  });

  it('has a jsdom document available', () => {
    expect(typeof document).toBe('object');
    expect(document.createElement('div')).not.toBeNull();
  });
});
