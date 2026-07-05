import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Vitest configuration for the Wedding Planner project.
// - jsdom environment enables React Testing Library DOM APIs.
// - setupTests.ts wires @testing-library/jest-dom matchers globally.
// - globals: true so `describe/it/expect` are available without import.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
