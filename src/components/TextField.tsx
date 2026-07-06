import { useId } from 'react';
import { InlineError } from './InlineError';

/**
 * TextField
 *
 * Labeled `<input type="text">` with an optional inline error slot.
 *
 * Contract:
 *  - `value` and `onChange(string)` form a controlled component pair.
 *  - `label` is always rendered; the `for`/`id` linkage is auto-generated when
 *    `id` is omitted via React's `useId` so consumers do not need to invent
 *    unique ids per render.
 *  - When `error` is a non-empty string the field applies `aria-invalid` and
 *    exposes the message to screen readers via `aria-describedby` + a rendered
 *    `<InlineError>`.
 *  - When `required` is true a visual asterisk is appended and the native
 *    `required` attribute is set on the input.
 *
 * Styling is delegated to the shared `.field`, `.field-label`, `.field-input`
 * classes in src/styles/global.css (Requirement 10.5 token compliance).
 */
export interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  /** 입력 가능한 최대 글자 수(띄어쓰기 포함). */
  maxLength?: number;
  /** true면 여러 줄 입력이 가능한 `<textarea>`로 렌더한다(줄바꿈 보존). */
  multiline?: boolean;
  /** multiline일 때 기본 표시 줄 수. */
  rows?: number;
  /** 라벨을 시각적으로 숨김(인라인 편집 셀 등). */
  hideLabel?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  error,
  required,
  id,
  placeholder,
  disabled,
  autoComplete,
  maxLength,
  multiline,
  rows,
  hideLabel,
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;

  const shared = {
    id: inputId,
    className: 'field-input',
    value,
    required,
    placeholder,
    disabled,
    maxLength,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': errorId,
  } as const;

  return (
    <div className="field">
      <label
        className={hideLabel ? 'field-label visually-hidden' : 'field-label'}
        htmlFor={inputId}
      >
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {multiline ? (
        <textarea
          {...shared}
          rows={rows ?? 4}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          {...shared}
          type="text"
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      <InlineError id={errorId}>{error}</InlineError>
    </div>
  );
}
