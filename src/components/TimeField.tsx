import { useEffect, useId, useState } from 'react';
import { InlineError } from './InlineError';

/**
 * TimeField
 *
 * 시(00~23) · 분(00/15/30/45) 두 개의 네이티브 `<select>` 드롭다운으로 시간을
 * 입력받는다. 오전/오후 구분 없는 24시간제이며, 분은 15분 단위로만 선택할 수
 * 있다(순환 없이 고정 목록).
 *
 * Contract:
 *  - `value`는 `HH:MM` 문자열 또는 빈 문자열("")이다. `Wed_Schedule.Wed_time`에
 *    저장되는 형태와 동일하다.
 *  - `onChange(hhmm)`은 시·분이 모두 선택된 경우에만 `HH:MM`을 방출하고, 둘 중
 *    하나라도 비어 있으면 빈 문자열을 방출한다(저장 게이트의 필수 검증이 막도록).
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

/** 00 ~ 23 (2자리 zero-pad). */
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) =>
  String(h).padStart(2, '0'),
);

/** 15분 단위 고정 목록. */
const MINUTE_OPTIONS = ['00', '15', '30', '45'] as const;

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

  const [hour, setHour] = useState<string>('');
  const [minute, setMinute] = useState<string>('');

  // 외부 `value`(폼 리셋·프리필 등)와 내부 상태를 동기화한다.
  useEffect(() => {
    if (/^\d{2}:\d{2}$/.test(value)) {
      const [h, m] = value.split(':');
      setHour(h);
      setMinute(m);
    } else if (value === '') {
      setHour('');
      setMinute('');
    }
  }, [value]);

  function emit(h: string, m: string): void {
    onChange(h !== '' && m !== '' ? `${h}:${m}` : '');
  }

  function handleHourChange(h: string): void {
    setHour(h);
    emit(h, minute);
  }

  function handleMinuteChange(m: string): void {
    setMinute(m);
    emit(hour, m);
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <div className="time-field-row">
        <select
          id={inputId}
          className="field-input time-field-select"
          value={hour}
          onChange={(e) => handleHourChange(e.target.value)}
          required={required}
          disabled={disabled}
          aria-label={`${label} 시`}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
        >
          <option value="" disabled>
            시
          </option>
          {HOUR_OPTIONS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="time-field-sep" aria-hidden="true">
          :
        </span>
        <select
          className="field-input time-field-select"
          value={minute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          required={required}
          disabled={disabled}
          aria-label={`${label} 분`}
          aria-invalid={error ? true : undefined}
        >
          <option value="" disabled>
            분
          </option>
          {MINUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <InlineError id={errorId}>{error}</InlineError>
    </div>
  );
}
