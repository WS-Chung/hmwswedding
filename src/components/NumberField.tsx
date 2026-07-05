import { useId } from 'react';
import { InlineError } from './InlineError';

/**
 * NumberField
 *
 * Labeled `<input type="number">` for KRW amounts and other integer inputs.
 *
 * Contract:
 *  - `value: number | null` is a controlled value. `null` renders as an empty
 *    input; any finite number renders as its decimal string.
 *  - `onChange` receives `number | null` — `null` when the user clears the
 *    input, otherwise the parsed number. Non-finite parses (NaN) are coerced
 *    to `null` so downstream code never sees NaN.
 *  - Defaults `min={0}` and `step={1}` match the budget item amount rules
 *    (0 이상 정수, Requirement 5.9) but can be overridden per call site.
 *
 * The number input still exposes free-form text entry in browsers; the
 * downstream save gate MUST re-validate via `isValidAmount` (validators.ts).
 * This component is a UX affordance, not the source of truth for validity.
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
  min?: number;
  step?: number;
  max?: number;
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
  min = 0,
  step = 1,
  max,
}: NumberFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const displayValue = value === null ? '' : String(value);

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        id={inputId}
        className="field-input"
        type="number"
        inputMode="numeric"
        min={min}
        step={step}
        max={max}
        value={displayValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') {
            onChange(null);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) ? parsed : null);
        }}
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
