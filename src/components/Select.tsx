import { useId } from 'react';
import { InlineError } from './InlineError';

/**
 * Select
 *
 * Labeled native `<select>` dropdown, styled to match the other form field
 * components (`TextField`, `NumberField`) via the shared `.field`,
 * `.field-label`, `.field-input` classes.
 *
 * Contract:
 *  - `value` / `onChange(string)` form a controlled component pair. The
 *    emitted string is the selected option's value which — per design —
 *    equals the option's visible label.
 *  - `options: readonly string[]` is the *authoritative* option set. Each
 *    entry produces one `<option value={opt}>{opt}</option>`. Property 9
 *    (design.md § Testing Strategy) requires: the rendered set of real
 *    option values equals `options` exactly at each render. Feeding a new
 *    array in causes the dropdown to reflect the new set on the next paint.
 *  - `placeholder`, when provided AND `value === ''`, prepends a disabled
 *    sentinel `<option value="">{placeholder}</option>`. This makes the
 *    placeholder visible when nothing is selected yet, but prevents it from
 *    ever being submitted as a legal value. Once `value` becomes non-empty,
 *    the sentinel is removed so the option list matches `options` exactly.
 *  - `error`, `required`, `disabled`, and the aria-invalid / aria-describedby
 *    wiring mirror `TextField` so screen-reader semantics remain consistent
 *    across every form control.
 *
 * Used by Budget_Item forms to bind the 카테고리 field to the live
 * `Wed_Budget_Category` set (Requirements 5.6, 6.8).
 */
export interface SelectProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  error?: string;
  required?: boolean;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function Select({
  label,
  value,
  onChange,
  options,
  error,
  required,
  id,
  placeholder,
  disabled,
}: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;
  const showPlaceholder = placeholder !== undefined && value === '';

  return (
    <div className="field">
      <label className="field-label" htmlFor={selectId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={selectId}
        className="field-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      >
        {showPlaceholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <InlineError id={errorId}>{error}</InlineError>
    </div>
  );
}
