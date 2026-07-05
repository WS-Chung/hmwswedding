import { useId } from 'react';
import { InlineError } from './InlineError';

/**
 * TimeField
 *
 * Labeled `<input type="time">`.
 *
 * Contract:
 *  - `value` is an `HH:MM` string OR the empty string when no time is set.
 *    Matches the shape stored in `Wed_Schedule.Wed_time` (nullable text/time).
 *  - `onChange(hhmm)` receives the raw value from the input (browsers emit
 *    `HH:MM` for time inputs by default, without seconds).
 *
 * When the field is optional (e.g. some Schedule use cases treat 시간 as
 * required per Requirement 2.14 — enforced at the save gate, not here) an
 * empty string is a valid intermediate state and this component happily
 * forwards it. The domain-level normalize functions turn empty strings into
 * `null` before writing to Supabase.
 */
export interface TimeFieldProps {
  label: string;
  /** `HH:MM` or empty string. */
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  id?: string;
  disabled?: boolean;
}

export function TimeField({
  label,
  value,
  onChange,
  error,
  required,
  id,
  disabled,
}: TimeFieldProps) {
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
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
      />
      <InlineError id={errorId}>{error}</InlineError>
    </div>
  );
}
