import { useState } from 'react';
import { DateField } from '../../components/DateField';
import { TextField } from '../../components/TextField';
import { TimeField } from '../../components/TimeField';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';
import { Modal } from '../../components/Modal';
import { normalizeSchedule } from '../../lib/normalize';
import { scheduleApi } from './scheduleApi';

/**
 * AddScheduleForm
 *
 * 일정 페이지의 "일정 추가" 액션이 여는 팝업 모달.
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
 *         · 성공 → `onSave()`를 호출해 상위가 목록 재조회 후 모달을 닫도록 위임.
 *         · 실패 → 표준화된 err.message를 InlineError로 노출, 폼 유지.
 */
export interface AddScheduleFormProps {
  /** 모달 열림 여부. false면 렌더되지 않는다. */
  isOpen: boolean;
  /** 폼 마운트 시 날짜 필드에 프리필할 ISO 문자열. 비면 사용자 입력. */
  initialDate?: string | null;
  /** create 성공 후 호출된다. 상위는 목록 재조회 + 모달 dismissal을 수행. */
  onSave: () => Promise<void> | void;
  /** 사용자 취소 / Esc / 오버레이 클릭 시 호출. 상위는 모달을 닫는다. */
  onCancel: () => void;
}

export function AddScheduleForm({ isOpen, initialDate, onSave, onCancel }: AddScheduleFormProps) {
  const [date, setDate] = useState<string>(initialDate ?? '');
  const [place, setPlace] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [schedule, setSchedule] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  async function handleSave() {
    if (submitting) return;
    setError('');

    const result = normalizeSchedule({
      Wed_date: date,
      Wed_place: place,
      Wed_time: time,
      Wed_schedule: schedule,
      Wed_note: note,
    });

    if (!result.ok) {
      setError(result.errors[0] ?? '입력값을 확인해주세요');
      return;
    }

    setSubmitting(true);
    try {
      await scheduleApi.create(result.value);
      await onSave();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : '저장에 실패했습니다.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="일정 추가"
      actions={
        <>
          <PillButton variant="secondary" onClick={onCancel} disabled={submitting}>
            취소
          </PillButton>
          <PillButton variant="primary" onClick={handleSave} disabled={submitting}>
            저장
          </PillButton>
        </>
      }
    >
      <DateField label="날짜" value={date} onChange={setDate} required />
      <TextField label="장소" value={place} onChange={setPlace} required />
      <TimeField label="시간" value={time} onChange={setTime} required />
      <TextField label="일정내용" value={schedule} onChange={setSchedule} required />
      <TextField label="메모" value={note} onChange={setNote} />
      <InlineError>{error}</InlineError>
    </Modal>
  );
}
