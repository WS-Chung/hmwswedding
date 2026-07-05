import { useEffect, useState } from 'react';
import { PageShell } from '../../components/PageShell';
import { PillButton } from '../../components/PillButton';
import { InlineError } from '../../components/InlineError';
import { TextField } from '../../components/TextField';
import { DataTable } from '../../components/DataTable';
import type { DataTableColumn } from '../../components/DataTable';
import { Modal } from '../../components/Modal';
import { normalizeContact } from '../../lib/normalize';
import { contactApi } from './contactApi';
import type { ContactRecord } from './contactApi';

/**
 * ContactPage (task 12.2)
 *
 * Contact_Manager의 사용자 대면 화면. 상단에 "추가" PillButton, 그 아래
 * DataTable(업체 · 담당자 · 전화번호 · 이메일 · 비고 5열)과 인라인 추가 폼을
 * 결합한 단일 페이지 컴포넌트.
 *
 * 데이터 흐름:
 *   1. mount 시 `contactApi.list()`로 전 행을 조회한다(Requirement 8.1).
 *   2. "추가" 클릭 → 하단에 인라인 폼이 열린다. 저장 성공 시 목록을 재조회.
 *   3. 행 인라인 편집(연필 → 저장) → `contactApi.update`로 diff 적용 후 재조회.
 *   4. 행 삭제 확인 → `contactApi.remove` 후 재조회.
 *
 * 저장 게이트(Requirement 8.6, 8.7):
 *   - 이메일이 비어있지 않은 경우에만 `isValidEmail` 검증(normalize 내부).
 *   - 전화번호는 `normalizeContact`를 통해 원문 그대로 저장(Property 16).
 *
 * 오류 처리(Requirement 2.5, Property 17):
 *   - 모든 mutation 실패는 표준화된 5종 메시지 중 하나로 InlineError에 노출.
 *   - 실패해도 로컬 `records` state는 이전 값 그대로 유지된다. `<DataTable>`이
 *     저장/삭제 실패 시 rows를 건드리지 않으며, 인라인 추가 폼도 성공 후에만
 *     records를 재조회한다.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7
 */

/**
 * DataTable 열 정의: 업체 · 담당자 · 전화번호 · 이메일 · 비고.
 * `null` 값은 빈 문자열로 렌더한다(자유 텍스트 컬럼 관례). 편집 모드에서는
 * DataTable 기본 텍스트 input이 사용되며, save 단계에서 `normalizeContact`가
 * 빈 문자열을 재차 검증 후 `null` 또는 원문으로 매핑한다.
 */
const columns: DataTableColumn<ContactRecord>[] = [
  {
    key: 'Wed_company',
    header: '업체',
  },
  {
    key: 'Wed_manager',
    header: '담당자',
    render: (row) => (row.Wed_manager === null ? '' : row.Wed_manager),
  },
  {
    key: 'Wed_phone',
    header: '전화번호',
    // 원문 그대로 표시(Requirement 8.7). null만 빈 문자열로 폴백.
    render: (row) => (row.Wed_phone === null ? '' : row.Wed_phone),
  },
  {
    key: 'Wed_email',
    header: '이메일',
    render: (row) => (row.Wed_email === null ? '' : row.Wed_email),
  },
  {
    key: 'Wed_note',
    header: '비고',
    render: (row) => (row.Wed_note === null ? '' : row.Wed_note),
  },
];

/** unknown 예외에서 사용자 문구를 추출한다(mapSupabaseError 결과 우선). */
function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return '요청을 처리할 수 없습니다.';
}

export function ContactPage() {
  const [records, setRecords] = useState<ContactRecord[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showAdd, setShowAdd] = useState<boolean>(false);

  // Add form 로컬 state — 5개 문자열 필드만 다룬다.
  const [company, setCompany] = useState<string>('');
  const [manager, setManager] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [addError, setAddError] = useState<string>('');

  /**
   * `contactApi.list()`를 호출해 records state를 교체한다. 실패 시 이전
   * records는 그대로 두고 페이지 상단 InlineError에 표준 메시지를 실는다.
   */
  async function refetch(): Promise<void> {
    try {
      const rows = await contactApi.list();
      setRecords(rows);
    } catch (err) {
      setErrorMsg(extractMessage(err));
    }
  }

  useEffect(() => {
    void refetch();
  }, []);

  function resetAddForm(): void {
    setCompany('');
    setManager('');
    setPhone('');
    setEmail('');
    setNote('');
    setAddError('');
  }

  function handleAddClick(): void {
    setErrorMsg('');
    resetAddForm();
    setShowAdd(true);
  }

  function handleAddCancel(): void {
    if (submitting) return;
    resetAddForm();
    setShowAdd(false);
  }

  /**
   * 인라인 추가 폼 저장 핸들러.
   *
   *   1. `normalizeContact`로 정규화 + 검증.
   *      · ok:false → 첫 번째 오류 메시지를 폼 하단 InlineError에 표시,
   *        폼은 유지되며 상위 records는 손대지 않는다.
   *   2. ok:true → `contactApi.create(value)` 호출.
   *      · 성공 → 폼 초기화 + 닫기 + `refetch()`로 상위 목록 재조회.
   *      · 실패 → 표준화된 err.message를 폼 InlineError에 표시. records 불변.
   */
  async function handleAddSave(): Promise<void> {
    if (submitting) return;
    setAddError('');

    const result = normalizeContact({
      Wed_company: company,
      Wed_manager: manager,
      Wed_phone: phone,
      Wed_email: email,
      Wed_note: note,
    });

    if (!result.ok) {
      setAddError(result.errors[0] ?? '입력값을 확인해주세요');
      return;
    }

    setSubmitting(true);
    try {
      await contactApi.create(result.value);
      resetAddForm();
      setShowAdd(false);
      await refetch();
    } catch (err) {
      setAddError(extractMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * 행 인라인 저장 핸들러. DataTable이 넘긴 patch는 사용자가 편집한 필드의
   * 문자열 값을 담고 있다. 기존 행과 병합한 뒤 `normalizeContact`로 재검증하고,
   * 통과 시 정규화된 payload를 `contactApi.update`에 그대로 전달한다.
   *
   * 이메일 유효성이 실패하거나 업체가 비어버린 경우 여기서 `throw` 하면
   * DataTable이 편집 모드를 유지하고 `onError`(→ setErrorMsg)로 문구를
   * 라우팅한다(Property 17 — 로컬 records state는 건드리지 않음).
   */
  async function handleSaveEdit(
    id: string,
    patch: Partial<ContactRecord>,
  ): Promise<void> {
    const current = records.find((r) => r.Wed_id === id);
    if (!current) {
      throw new Error('편집 대상 레코드를 찾을 수 없습니다.');
    }

    // patch에 있는 필드는 사용자가 입력한 문자열(빈 문자열 포함).
    // patch에 없는 필드는 current의 값을 문자열로 다시 인코딩한다:
    //   · null   → ""  (normalize가 다시 null로 복원)
    //   · string → 그대로 (전화번호 원문 유지 · Requirement 8.7)
    function coalesce(
      key: keyof ContactRecord,
      currentValue: string | null,
    ): string {
      if (key in patch) {
        const patched = (patch as Record<string, unknown>)[key as string];
        return patched === null || patched === undefined
          ? ''
          : String(patched);
      }
      return currentValue === null ? '' : currentValue;
    }

    const result = normalizeContact({
      Wed_company: coalesce('Wed_company', current.Wed_company),
      Wed_manager: coalesce('Wed_manager', current.Wed_manager),
      Wed_phone: coalesce('Wed_phone', current.Wed_phone),
      Wed_email: coalesce('Wed_email', current.Wed_email),
      Wed_note: coalesce('Wed_note', current.Wed_note),
    });

    if (!result.ok) {
      throw new Error(result.errors[0] ?? '입력값을 확인해주세요');
    }

    await contactApi.update(id, result.value);
    await refetch();
  }

  /**
   * 행 삭제 핸들러. `<DataTable>`이 확인 다이얼로그를 이미 처리했으므로
   * 여기서는 API 호출 + 재조회만 담당한다. 실패 시 throw → DataTable이
   * `onError`로 상단 InlineError에 표준 메시지를 라우팅한다.
   */
  async function handleDelete(id: string): Promise<void> {
    await contactApi.remove(id);
    await refetch();
  }

  return (
    <PageShell
      title="연락처"
      toolbar={
        <PillButton onClick={handleAddClick} disabled={showAdd}>
          추가
        </PillButton>
      }
    >
      <InlineError>{errorMsg}</InlineError>

      <DataTable<ContactRecord>
        rows={records}
        columns={columns}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onError={setErrorMsg}
        emptyMessage="등록된 연락처가 없습니다"
      />

      <Modal
        isOpen={showAdd}
        onClose={handleAddCancel}
        title="연락처 추가"
        actions={
          <>
            <PillButton
              variant="secondary"
              onClick={handleAddCancel}
              disabled={submitting}
            >
              취소
            </PillButton>
            <PillButton
              variant="primary"
              onClick={handleAddSave}
              disabled={submitting}
            >
              저장
            </PillButton>
          </>
        }
      >
        <TextField label="업체" value={company} onChange={setCompany} required />
        <TextField label="담당자" value={manager} onChange={setManager} />
        <TextField label="전화번호" value={phone} onChange={setPhone} />
        <TextField label="이메일" value={email} onChange={setEmail} />
        <TextField label="비고" value={note} onChange={setNote} />
        <InlineError>{addError}</InlineError>
      </Modal>
    </PageShell>
  );
}
