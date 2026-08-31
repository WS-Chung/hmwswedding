// 디자인 토큰이 전역 스타일보다 먼저 로드되어야 global.css의 custom property
// 참조가 해석된다. 두 파일 모두 엔트리 최상단에서 import 하므로 이후 모든
// 컴포넌트가 DrimAES Light Web UI Kit v1.0 디자인 시스템을 상속한다
// (DA_WEBUI_KIT.md §4 컬러 · §5 타이포 · §7.3 globals).
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
