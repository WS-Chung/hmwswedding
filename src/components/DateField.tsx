import { useId } from 'react';
import { InlineError } from './InlineError';

/**
 * DateField
 *
 * Labeled `<input type="date">`.
 *
 * Contract:
 *  - `value` is an ISO `YYYY-MM-DD` string OR the empty string when no date is
 *    selected. This matches how `Wed_date` columns are persisted and read from
 *    Supabase without additional parsing.
 *  - `onChange(iso)` receives the same shape — the raw value from the native
 *    date input, which browsers emit as `YYYY-MM-DD` or `''`.
 *
 * Note: browsers may render locale-specific date pickers, but the underlying
 * value model is always ISO 8601 short-date, so it is safe to feed directly
 * into `computeHighlightedDates`, `sortByDate`, and Supabase.
 */
export interface DateFieldProps {
  label: string;
  /** ISO date `YYYY-MM-DD` or empty string. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  id?: string;
  disabled?: boolean;
  min?: string;
  max?: string;
}

export function DateField({
  label,
  value,
  onChange,
  error,
  required,
  id,
  disabled,
  min,
  max,
}: DateFieldProps) {
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
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      />
      <InlineError id={errorId}>{error}</InlineError>
    </div>
  );
}
