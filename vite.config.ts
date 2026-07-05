import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// HashRouter-compatible static build (no SSR, no server routes).
// The bundle is a single-page app served from any static host (Vercel).
// Using relative base ('./') keeps asset URLs valid regardless of hosting subpath.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020',
    // Emit a static asset bundle only. No SSR / server entry.
    ssr: false,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});
