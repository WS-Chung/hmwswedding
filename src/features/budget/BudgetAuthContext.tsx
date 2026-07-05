/**
 * Budget_Auth 세션 상태 Provider.
 *
 * 예산관리 라우트 진입 전에 사용자가 Budget_Password 확인을 통과했는지를
 * 브라우저 세션(sessionStorage) 스코프로 기억한다.
 *
 * 요구사항 매핑:
 * - Requirement 4.7: 인증 성공 이후 동일 브라우저 세션이 유지되는 동안
 *   다른 페이지로 이동했다가 예산관리로 돌아와도 비밀번호를 다시 요구하지 않는다.
 * - Requirement 4.8: 브라우저 탭을 닫거나 새로 고침을 통해 세션이 초기화되면
 *   다음 예산관리 진입 시 비밀번호 입력을 다시 요구한다.
 *
 * 설계 노트:
 * - `sessionStorage`는 탭 단위 수명을 가지므로 4.7(라우트 재진입 유지) +
 *   4.8(탭 종료 시 초기화)를 스토리지 계층에서 자연스럽게 만족한다.
 * - 초기 상태를 `useState`의 lazy initializer에서 한 번만 읽어 컨텍스트를
 *   구독하는 자식 트리에 대해 안정된 값을 노출한다.
 * - `signOut` 메서드는 의도적으로 제공하지 않는다. 세션 종료는 오직 탭 종료 /
 *   새로 고침으로만 일어난다(Requirement 4.8).
 */

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { checkBudgetPassword } from '../../lib/validators';

/** `sessionStorage`에 인증 플래그를 기록할 때 사용하는 고정 키. */
const SESSION_KEY = 'wed_budget_authed';
/** 인증 성공 시 저장되는 플래그 값. 다른 어떤 값도 authed로 취급되지 않는다. */
const SESSION_VALUE = '1';

export type BudgetAuthContextValue = {
  /** 현재 세션에서 Budget_Password 확인을 통과한 상태인지 여부. */
  isAuthed: boolean;
  /**
   * 사용자 입력을 Budget_Password와 대조한다.
   *
   * 성공 시 `sessionStorage`에 플래그를 저장하고 `isAuthed`를 true로 갱신한 뒤
   * `true`를 반환한다. 실패 시 아무런 상태 변경 없이 `false`를 반환하며
   * 잠금·차단·재시도 카운터 등의 부작용을 발생시키지 않는다(Requirement 4.6).
   */
  authenticate: (input: string) => boolean;
};

export const BudgetAuthContext = createContext<BudgetAuthContextValue | undefined>(
  undefined,
);

/**
 * SSR 환경 또는 `sessionStorage`가 비활성화된 환경(예: 시크릿 모드 격리)에서도
 * 안전하게 초기값을 계산한다. 접근 자체가 예외를 던지면 미인증 상태로 취급한다.
 */
function readInitialAuthed(): boolean {
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return false;
    return window.sessionStorage.getItem(SESSION_KEY) === SESSION_VALUE;
  } catch {
    return false;
  }
}

export function BudgetAuthProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState<boolean>(readInitialAuthed);

  const authenticate = useCallback((input: string): boolean => {
    if (!checkBudgetPassword(input)) {
      return false;
    }
    try {
      window.sessionStorage.setItem(SESSION_KEY, SESSION_VALUE);
    } catch {
      // 스토리지 쓰기 실패는 세션 지속성만 잃을 뿐 인증 성공 자체를 무효화하지
      // 않는다. 현재 탭에서는 in-memory 상태로 authed를 유지한다.
    }
    setIsAuthed(true);
    return true;
  }, []);

  return (
    <BudgetAuthContext.Provider value={{ isAuthed, authenticate }}>
      {children}
    </BudgetAuthContext.Provider>
  );
}

/**
 * `BudgetAuthProvider` 하위에서 인증 상태를 조회한다.
 * Provider 없이 호출되면 개발 시점에 실수를 빠르게 드러내기 위해 예외를 던진다.
 */
export function useBudgetAuth(): BudgetAuthContextValue {
  const ctx = useContext(BudgetAuthContext);
  if (!ctx) {
    throw new Error('useBudgetAuth must be used within <BudgetAuthProvider>');
  }
  return ctx;
}
