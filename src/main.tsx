// Global design tokens must load before global styles so custom properties
// referenced from global.css resolve. Both are pulled in here at the top of
// the entry module so every subsequent component inherits the Apple-style
// design system (Requirements 10.1–10.6).
import './styles/tokens.css';
import './styles/global.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

// Task 9.2: bootstrap now mounts the real <App /> shell (HashRouter +
// SideNavigation + route outlet). The route definitions and layout live in
// `./App.tsx`; this entry is intentionally kept minimal so tooling and tests
// can substitute alternative roots (e.g. MemoryRouter) around <App /> as
// needed.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element with id "root" was not found in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
