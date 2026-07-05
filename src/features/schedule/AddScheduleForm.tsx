import { useState } from 'react';
import { DateField } from '../../components/DateField';
import { TextField } from '../../components/TextField';
import { TimeField } from '../../components/TimeField';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';
import { normalizeSchedule } from '../../lib/normalize';
import { scheduleApi } from './scheduleApi';

/**
 * AddScheduleForm
 *
 * 일정 페이지의 "일정 추가" 액션이 열어주는 인라인 카드 폼.
 *
 * 필드 순서(Requirement 2.7 · 2.8 · 2.13):
 *   1. 날짜 (DateField, 필수)   — `initialDate`가 주어지면 초기값으로 프리필
 *   2. 장소 (TextField, 필수)
 *   3. 시간 (TimeField, 필수)
 *   4. 일정내용 (TextField, 필수)
 *   5. 메모 (TextField, 선택)
 *
 * 저장 흐름(Requirement 2.9 · 2.14):
 *   - "저장" 클릭 → `normalizeSchedule(...)` 호출.
 *     * `ok: false` → 첫 번째 오류 메시지를 InlineError로 노출, 폼 유지.
 *     * `ok: true`  → `scheduleApi.create(value)` 호출.
 *         · 성공 → `onSave()`를 호출해 상위(SchedulePage)가 목록을 재조회하고
 *           폼을 닫도록 위임한다.
 *         · 실패 → 던져진 `err.message`(이미 `mapSupabaseError`로 표준화된
 *           5종 문구 중 하나)를 InlineError로 노출, 폼 유지.
 *
 * 이 컴포넌트는 상태 관리만 담당하며 상위 페이지의 리스트/달력 상태를 절대
 * 건드리지 않는다. 저장 실패 시에도 상위 상태 불변식(Property 17)이
 * 그대로 유지된다.
 */
export interface AddScheduleFormProps {
  /** 폼 마운트 시 날짜 필드에 프리필할 ISO 문자열. 비면 사용자 입력. */
  initialDate?: string | null;
  /** create 성공 후 호출된다. 상위는 목록 재조회 + 폼 dismissal을 수행. */
  onSave: () => Promise<void> | void;
  /** 취소 버튼 클릭 시 호출. 상위는 폼을 닫는다. */
  onCancel: () => void;
}

export function AddScheduleForm({ initialDate, onSave, onCancel }: AddScheduleFormProps) {
  // 5개 필드를 모두 문자열 로컬 state로 관리한다. 초기값 규칙:
  //   - 날짜: initialDate가 비지 않으면 그 값, 그 외 빈 문자열
  //   - 나머지 필드: 빈 문자열
  const [date, setDate] = useState<string>(initialDate ?? '');
  const [place, setPlace] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [schedule, setSchedule] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // 저장 중 중복 클릭 방지 + 오류 메시지 노출용 상태.
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  async function handleSave() {
    if (submitting) return;

    // 이전 오류 메시지를 지운 뒤 검증 → 저장 시퀀스를 시작한다.
    setError('');

    const result = normalizeSchedule({
      Wed_date: date,
      Wed_place: place,
      Wed_time: time,
      Wed_schedule: schedule,
      Wed_note: note,
    });

    if (!result.ok) {
      // 첫 번째 오류 메시지만 표면화 — 다중 실패 시에도 사용자는 한 번에
      // 한 이슈에만 집중한다(폼은 유지되어 다른 필드는 그대로 보존).
      setError(result.errors[0] ?? '입력값을 확인해주세요');
      return;
    }

    setSubmitting(true);
    try {
      await scheduleApi.create(result.value);
      // 상위가 목록 재조회 + 폼 닫기를 담당한다. 여기서는 로컬 state를
      // 재설정하지 않는다(언마운트되면서 자연스레 사라짐).
      await onSave();
    } catch (err) {
      // scheduleApi.create는 실패 시 `mapSupabaseError`로 표준화된 문구를
      // `err.message`에 실어 던진다. 문구를 그대로 InlineError로 노출.
      const message =
        err instanceof Error && err.message ? err.message : '저장에 실패했습니다.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="schedule-add-form" role="dialog" aria-label="일정 추가">
      <DateField
        label="날짜"
        value={date}
        onChange={setDate}
        required
      />
      <TextField
        label="장소"
        value={place}
        onChange={setPlace}
        required
      />
      <TimeField
        label="시간"
        value={time}
        onChange={setTime}
        required
      />
      <TextField
        label="일정내용"
        value={schedule}
        onChange={setSchedule}
        required
      />
      <TextField
        label="메모"
        value={note}
        onChange={setNote}
      />

      <InlineError>{error}</InlineError>

      <div className="schedule-add-form-actions">
        <PillButton variant="secondary" onClick={onCancel} disabled={submitting}>
          취소
        </PillButton>
        <PillButton variant="primary" onClick={handleSave} disabled={submitting}>
          저장
        </PillButton>
      </div>
    </div>
  );
}
