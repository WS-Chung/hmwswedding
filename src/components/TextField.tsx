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
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={inputId}
        className="field-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      />
      <InlineError id={errorId}>{error}</InlineError>
    </div>
  );
}
