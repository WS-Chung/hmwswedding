import { useState, type FormEvent, type ReactNode } from 'react';

import { useBudgetAuth } from './BudgetAuthContext';
import { PageShell } from '../../components/PageShell';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';

/**
 * BudgetAuthGate
 *
 * 예산관리 라우트 진입 시 Budget_Password 확인을 강제하는 게이트 컴포넌트.
 * 인증 상태는 `BudgetAuthContext`가 `sessionStorage` 스코프로 관리하므로 이
 * 컴포넌트는 스토리지에 직접 접근하지 않고 컨텍스트가 노출하는 파생값
 * (`isAuthed`)과 액션(`authenticate`)만을 사용한다.
 *
 * 렌더링 규칙:
 *  - 이미 인증된 세션이면 `children`을 즉시 렌더한다(Requirement 4.7).
 *  - 미인증 상태에서는 라벨("비밀번호") + 비밀번호 input + "확인" PillButton
 *    + (있을 때) 실패 메시지만을 렌더한다.
 *  - 성공 시 컨텍스트가 세션 플래그를 저장하고 `isAuthed`가 true가 되면서
 *    다음 렌더에서 게이트가 사라진다(Requirement 4.4).
 *
 * Requirement 4.3 준수 — 비밀번호 값의 구조를 유추 가능한 어떠한 표식도
 * 렌더링하지 않는다:
 *  - `<input>`에 `placeholder`를 두지 않는다.
 *  - 실시간 자릿수 안내·헬퍼 텍스트·문자 카운터를 두지 않는다.
 *  - `autoComplete="off"`로 브라우저가 값을 저장·복원하도록 유도하지 않는다.
 *  - 실패 메시지는 정확히 "비밀번호가 일치하지 않습니다" 한 줄이며 자릿수·
 *    숫자 여부·힌트 문구를 포함하지 않는다.
 *
 * Requirement 4.6 준수 — 재시도 잠금·차단 없음. 실패 횟수 카운터·지연·
 * CAPTCHA·백오프 등의 상태 전환을 발생시키지 않는다. 사용자는 어떤 실패
 * 횟수 이후에도 즉시 다음 시도를 제출할 수 있다.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
export interface BudgetAuthGateProps {
  /**
   * 인증 성공 시 렌더링되는 실제 예산관리 콘텐츠(BudgetPage 등).
   */
  children: ReactNode;
}

/** 실패 안내 문구 — Requirement 4.3에 따라 정확히 이 한 문장만 노출한다. */
const FAILURE_MESSAGE = '비밀번호가 일치하지 않습니다';

export function BudgetAuthGate({ children }: BudgetAuthGateProps) {
  const { isAuthed, authenticate } = useBudgetAuth();
  const [input, setInput] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Requirement 4.7: 세션이 이미 인증된 상태면 게이트를 우회한다.
  if (isAuthed) {
    return <>{children}</>;
  }

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // `authenticate`는 내부적으로 `checkBudgetPassword`로 정확 일치를 판정하고,
    // 성공 시 sessionStorage에 인증 플래그를 저장한 뒤 컨텍스트 상태를 갱신한다
    // (Requirement 4.4). 실패 시에는 어떠한 부작용도 남기지 않는다
    // (Requirement 4.6 - 잠금·차단 없음).
    const ok = authenticate(input);
    if (ok) {
      // 성공 경로에서는 컨텍스트가 트리거한 리렌더에서 `isAuthed === true`로
      // 즉시 자식이 노출되므로 여기서 명시적 상태 갱신은 하지 않는다.
      return;
    }

    // 실패 경로: 표준 문구만 표시하고 입력값을 비운다. 시도 카운터·타이머·
    // 지연 등의 어떠한 lockout 상태도 도입하지 않는다.
    setErrorMsg(FAILURE_MESSAGE);
    setInput('');
  };

  return (
    <PageShell title="예산관리">
      <form
        className="budget-auth-gate"
        onSubmit={handleSubmit}
        noValidate
        aria-label="예산관리 비밀번호 입력"
      >
        <label className="field-label" htmlFor="budget-auth-password">
          비밀번호
        </label>
        {/*
         * 의도적으로 다음 속성들을 두지 않는다(Requirement 4.3):
         *  - placeholder            (구조 유추 방지)
         *  - minLength              (하한 검증은 프론트에서 수행하지 않음)
         *  - pattern                (숫자/자리수 힌트 방지)
         *  - inputMode="numeric"    (숫자임을 노출하지 않기 위함)
         *  - 문자 카운터·헬퍼 텍스트 (구조 유추 방지)
         *
         * `maxLength={64}`는 순수 안전상한이며 하한 정보는 노출하지 않는다.
         * `autoComplete="off"`로 브라우저가 값을 저장/복원하려 시도하지 않도록 한다.
         */}
        <input
          id="budget-auth-password"
          className="field-input"
          type="password"
          value={input}
          maxLength={64}
          autoComplete="off"
          onChange={(e) => setInput(e.target.value)}
        />
        <PillButton type="submit">확인</PillButton>
        <InlineError>{errorMsg}</InlineError>
      </form>
    </PageShell>
  );
}
