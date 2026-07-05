import { useId } from 'react';
import { InlineError } from './InlineError';

/**
 * NumberField
 *
 * 금액(원 단위 정수) 입력 필드. 스핀 버튼(위/아래 화살표)이 붙는
 * `<input type="number">` 대신, 스핀 버튼이 없는 텍스트 입력을 사용하고
 * 숫자만 직접 입력받는다. 표시 값은 세 자리마다 쉼표로 자릿수를 구분한다.
 *
 * Contract:
 *  - `value: number | null` 컨트롤드 값. `null`이면 빈 입력으로 렌더된다.
 *  - 화면에는 `value.toLocaleString('en-US')`로 쉼표가 찍힌 문자열이 보인다
 *    (예: 1200000 → "1,200,000").
 *  - `onChange`는 입력에서 숫자 이외 문자(쉼표 포함)를 모두 제거한 뒤 정수로
 *    파싱한 `number`를 방출하고, 빈 입력이면 `null`을 방출한다.
 *  - 저장 게이트는 여전히 `isValidAmount`(validators.ts)로 재검증한다. 이
 *    컴포넌트는 UX 편의일 뿐 유효성의 원천이 아니다.
 */
export interface NumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error?: string;
  required?: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** 접근성 라벨을 시각적으로 숨기고 싶을 때(인라인 편집 셀 등) 사용. */
  hideLabel?: boolean;
}

export function NumberField({
  label,
  value,
  onChange,
  error,
  required,
  id,
  placeholder,
  disabled,
  hideLabel,
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const displayValue = value === null ? '' : value.toLocaleString('en-US');

  function handleChange(raw: string): void {
    // 숫자 이외(쉼표·공백·문자)는 모두 제거한 뒤 파싱한다.
    const digits = raw.replace(/[^\d]/g, '');
    if (digits === '') {
      onChange(null);
      return;
    }
    const parsed = Number(digits);
    onChange(Number.isFinite(parsed) ? parsed : null);
  }

  return (
    <div className="field">
      <label
        className={hideLabel ? 'field-label visually-hidden' : 'field-label'}
        htmlFor={inputId}
      >
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={inputId}
        className="field-input"
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      />
      <InlineError id={errorId}>{error}</InlineError>
    </div>
  );
}
