// Global test setup: extends Vitest's `expect` with @testing-library/jest-dom matchers
// (e.g. `toBeInTheDocument`, `toHaveClass`) and installs React Testing Library
// afterEach cleanup so DOM state does not leak between tests.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
