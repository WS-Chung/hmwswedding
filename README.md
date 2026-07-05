# Wedding Planner

결혼 준비 과정에서 발생하는 **일정 · 결정사항 · 예산관리 · 연락처**를 한 곳에서 관리하는 개인용 웹 애플리케이션이다. 정적 프론트엔드(Vite + React + TypeScript)가 Vercel에 배포되고, 모든 데이터는 Supabase(Postgres)에 저장된다. 별도 로그인 없이 anon-public 키로 직접 DB에 CRUD 요청을 보내는 2계층 구조다.

## 기술 스택

- **빌드/번들러**: Vite 5
- **프레임워크**: React 18 + TypeScript 5
- **라우팅**: react-router-dom (HashRouter)
- **데이터**: Supabase JS SDK (`@supabase/supabase-js`)
- **테스트**: Vitest + Testing Library + fast-check
- **배포**: Vercel (정적 자산)

## 페이지 구성

| 경로 | 페이지 | 설명 |
| --- | --- | --- |
| `/` | 일정 (Schedule) | 2026년 7월 달력을 초기 표시. 날짜 클릭 시 해당 일자 일정 CRUD |
| `/decision` | 결정사항 (Decision) | 결정 항목 CRUD |
| `/budget` | 예산관리 (Budget) | 비밀번호 게이트 통과 후 총액/사용/잔여 요약 + 항목·카테고리 CRUD |
| `/contact` | 연락처 (Contact) | 연락처 CRUD |

초기 진입 URL은 `/`(일정 페이지)로, 2026년 7월 달력이 렌더링된다 (Requirement 1.4, 2.2).

## 사전 요구 사항

- **Node.js 18 이상** 및 **npm**
- **Supabase 프로젝트** 하나 (`db/schema.sql`을 적용할 수 있는 권한)
- (배포 시) GitHub 계정 + Vercel 계정

## 설치 및 초기 설정

### 1. 의존성 설치

```bash
npm install
```

### 2. Supabase 스키마 적용

Supabase 대시보드 → **SQL Editor** → New query 에 `db/schema.sql` 전체를 붙여넣고 실행한다. 5개 테이블(`Wed_Schedule`, `Wed_Decision`, `Wed_Budget_Category`, `Wed_Budget_Item`, `Wed_Contact`)이 생성되고 초기 카테고리 8개가 시드된다. RLS 정책도 함께 적용된다.

### 3. Supabase anon 키 삽입

`src/config/supabase.ts` 를 열면 `SUPABASE_ANON_KEY` 상수가 다음 플레이스홀더로 설정돼 있다.

```ts
export const SUPABASE_ANON_KEY = '__REPLACE_WITH_SUPABASE_ANON_KEY__';
```

Supabase 대시보드 → **Settings → API → Project API keys → `anon` `public`** 값을 복사해 위 문자열을 교체한다.

> **참고**
> - `SUPABASE_URL`은 이미 프로젝트 URL로 하드코딩돼 있어 별도 수정이 필요 없다.
> - anon-public 키만 프론트엔드에 포함하며, **`service_role` 키는 절대 커밋하지 않는다**.
> - 환경 변수 주입 단계는 존재하지 않는다. 키는 소스에 그대로 들어가 번들에 포함된다 (Requirement 9.5, 9.6, 11.2).

## 로컬 개발

```bash
npm run dev
```

기본적으로 `http://localhost:5173` 에서 앱이 뜨고, 최초 화면은 `/` 로 리다이렉트되며 2026년 7월 달력이 표시된다.

## 빌드

```bash
npm run build
```

`tsc -b`로 타입 체크를 수행한 뒤 `vite build`가 `dist/` 에 정적 자산(HTML/CSS/JS)을 생성한다. 이 디렉터리가 Vercel에 배포되는 산출물이다.

로컬에서 빌드 결과를 미리 확인하려면 다음을 사용한다.

```bash
npm run preview
```

## 테스트

```bash
npm test
```

Vitest + Testing Library + fast-check 기반 단위/속성 테스트 스위트를 1회 실행한다. 감시 모드가 필요하면 `npm run test:watch`.

## Vercel 배포

1. **저장소를 GitHub에 푸시**한다.
2. Vercel 대시보드에서 **New Project → Import Git Repository**로 해당 저장소를 선택한다.
3. **Framework Preset**: Vite (저장소 루트의 `vercel.json` / `vite.config.ts` 를 통해 자동 감지된다).
4. **Build Command**: `npm run build` (기본값 유지).
5. **Output Directory**: `dist` (기본값 유지).
6. **Environment Variables**: 설정하지 않는다. anon 키는 이미 `src/config/supabase.ts`에 포함돼 번들에 그대로 실린다 (Requirement 11.2).
7. **Deploy**를 누르면 Vercel이 `npm install → npm run build`를 실행하고 `dist/`를 CDN에 게시한다.

배포 URL로 접속하면 **별도 로그인 없이** 초기 페이지(일정)가 렌더링되며, 좌측 사이드 내비게이션으로 4개 페이지를 오갈 수 있다 (Requirement 11.3).

## 예산 페이지 비밀번호

예산관리 페이지는 진입 시 고정 비밀번호를 요구한다.

- **비밀번호**: `0329`

이 값은 스펙에 의해 소스에 하드코딩된 상수(`BUDGET_PASSWORD`, `src/lib/validators.ts`)이며 서버 사이드 검증은 존재하지 않는 취미 프로젝트용 게이트다. 세션은 유지되지 않으며 새로고침/재진입 시 다시 요구된다.

## 프로젝트 구조

```
.
├── db/
│   └── schema.sql             # Supabase DDL + RLS + 카테고리 시드
├── src/
│   ├── config/supabase.ts     # SUPABASE_URL / SUPABASE_ANON_KEY 상수
│   ├── lib/                   # 검증, 정규화, 계산 등 순수 로직
│   ├── components/            # 공용 UI (PageShell, DataTable, InlineError 등)
│   ├── features/
│   │   ├── schedule/          # 일정
│   │   ├── decision/          # 결정사항
│   │   ├── budget/            # 예산관리 (Auth gate 포함)
│   │   └── contact/           # 연락처
│   ├── styles/                # tokens.css, global.css
│   ├── App.tsx                # HashRouter + 라우트 정의
│   └── main.tsx               # 엔트리
├── index.html
├── vite.config.ts
└── package.json
```

## 참고 문서

- `UI_Design.md` — 디자인 토큰과 컴포넌트 시각 규격
- `.kiro/specs/wedding-planner/requirements.md` — EARS 형식 수용 기준
- `.kiro/specs/wedding-planner/design.md` — 아키텍처 및 컴포넌트 계약
