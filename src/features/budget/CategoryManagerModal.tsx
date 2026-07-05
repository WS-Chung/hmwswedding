// features/budget/CategoryManagerModal.tsx
//
// Category_Manager 마스터 편집 모달.
//
// BudgetPage 우상단의 "카테고리 관리" 트리거가 이 모달을 열고, 사용자는
// `Wed_Budget_Category` 마스터 행에 대해 다음 CRUD 를 수행한다
// (design.md § CategoryManagerModal · Requirements 6.2 – 6.7):
//
//   - 추가: 하단의 "새 카테고리 추가" 입력 + PillButton.
//           로컬 목록으로 `canAddCategory` 사전 검사 → 통과 시
//           `categoryApi.create({ Wed_name })` → 성공 시 재조회.
//           중복이면 InlineError("이미 존재하는 카테고리입니다.").
//   - 수정: 행 별 "편집" → 인라인 입력으로 전환 → 저장 시
//           `categoryApi.update(id, { Wed_name })` → 재조회.
//           자기 자신을 제외한 나머지 이름들에 대해 canAddCategory 사전 검사.
//   - 삭제: 행 별 "삭제". 두 단계 게이트를 순서대로 통과해야 실제 삭제된다.
//       1) 로컬 게이트 — `canDeleteCategory(items, name)` 로 프론트가
//          알고 있는 Budget_Item 목록에 해당 카테고리 참조가 없는지 확인.
//       2) 서버 게이트 — `categoryApi.countItemsUsingCategory(name)` 로
//          Supabase 를 재확인(belt-and-suspenders). 프론트에서 items 목록이
//          최신이 아닐 때(다른 세션에서 방금 추가된 항목 등)를 방어한다.
//       둘 중 하나라도 참조가 남아있으면 삭제를 거부하고
//       InlineError("이 카테고리를 사용하는 항목이 있어 삭제할 수 없습니다.").
//
// 모든 성공 mutation 이후 상위(BudgetPage)의 `onCategoriesChanged()`를
// 호출해 상위가 카테고리 목록과 items 를 함께 refetch 하도록 한다. 이로써
// `BudgetItemTable` 의 카테고리 `<Select>` 옵션 집합이 마스터 집합과 즉시
// 일치하게 된다(Requirements 5.6, 6.8 — Property 9).
//
// 렌더링 규칙:
//   - `isOpen` 이 false 이면 아무 것도 렌더링하지 않는다(오버레이 X).
//   - 오버레이/카드 레이아웃은 `.confirm-dialog` + 전용 `.category-manager-*`
//     클래스를 사용해 삭제 다이얼로그와 동일한 톤을 유지한다.
//   - 이 모달 내부에서는 DataTable 을 사용하지 않는다: 삭제 흐름이 2-단계
//     게이트(reference count)를 거쳐야 하므로 표준 DataTable 의 단순
//     "확인 → 삭제" 다이얼로그로는 요구사항 6.7 을 표현할 수 없다.
//
// Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6, 6.7

import { useEffect, useMemo, useState } from 'react';

import { canAddCategory, canDeleteCategory } from '../../lib/category';
import {
  ERR_CATEGORY_DUP,
  ERR_CATEGORY_REF,
} from '../../lib/errorMapping';
import { categoryApi } from './categoryApi';
import type { BudgetCategory } from './categoryApi';
import type { BudgetItem } from './budgetApi';
import { PillButton } from '../../components/PillButton';
import { TextField } from '../../components/TextField';
import { InlineError } from '../../components/InlineError';

export interface CategoryManagerModalProps {
  /** true 인 동안에만 모달이 렌더링된다. false → 컴포넌트가 null 을 반환. */
  isOpen: boolean;
  /** 사용자가 "닫기"/취소 등으로 모달을 닫을 때 호출. 상위가 isOpen 을 false 로. */
  onClose: () => void;
  /**
   * 카테고리 CRUD 성공 후 호출된다. 상위(BudgetPage)는 이 콜백에서
   * 카테고리 목록과 Budget_Item 목록을 함께 refetch 하여 드롭다운 옵션과
   * 표시 항목이 모두 최신 상태를 반영하도록 한다.
   */
  onCategoriesChanged: () => Promise<void> | void;
  /**
   * 삭제 사전 게이트에 사용할 현재 Budget_Item 목록(부모가 소유).
   * 이 값은 지역적으로 변경되지 않고, 참조 무결성 검사에만 사용된다.
   */
  items: BudgetItem[];
}

/** 표시할 오류 문구가 없음을 나타내는 sentinel. */
const NO_ERROR = '';

/** 기본 fallback — API 가 Error 아닌 예외를 던진 경우에 대한 최소 안내. */
const FALLBACK_ERROR = '요청을 처리할 수 없습니다.';

/**
 * 임의의 throw 된 값에서 사용자에게 노출 가능한 메시지를 뽑는다.
 * `categoryApi` 는 실패 시 `mapSupabaseError` 로 표준화된 5종 문구를
 * `err.message` 에 실어 던지므로 대부분의 경우 그 값이 그대로 나온다.
 */
function extractMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.length > 0) return err;
  return FALLBACK_ERROR;
}

export function CategoryManagerModal({
  isOpen,
  onClose,
  onCategoriesChanged,
  items,
}: CategoryManagerModalProps) {
  // ---- 로컬 상태 ----------------------------------------------------------
  //
  // categories : 서버에서 조회한 카테고리 마스터 목록. 이 컴포넌트 로컬로
  //              소유하며, 상위는 `onCategoriesChanged` 를 통해 별도 refetch
  //              한다.
  // newName    : 하단 "새 카테고리 추가" 입력 값.
  // errorMsg   : 표시 중인 오류(중복/참조/네트워크 등)의 사용자 메시지.
  // editingId  : 인라인 편집 중인 카테고리 행의 Wed_id. 한 번에 한 행만 편집.
  // editName   : 편집 중인 이름 버퍼.
  // busy       : 현재 진행 중인 mutation 이 있는지 여부(중복 클릭 방지).
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [newName, setNewName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>(NO_ERROR);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [busy, setBusy] = useState<boolean>(false);

  /**
   * 서버 조회를 수행하고 로컬 categories 상태를 갱신한다.
   * 실패해도 이전 목록은 그대로 두어(Property 17) 화면이 비어버리지 않게 한다.
   */
  async function reloadCategories() {
    try {
      const rows = await categoryApi.list();
      setCategories(rows);
    } catch (err) {
      setErrorMsg(extractMessage(err));
    }
  }

  // 모달이 열릴 때마다 상태를 초기화하고 카테고리를 다시 조회한다.
  //
  // 왜 매번 초기화하나: 이 컴포넌트는 상위가 isOpen 만 토글하는 방식(마운트
  // 유지)이어도 안전해야 한다. 이전에 남았던 편집 상태·입력값·오류 메시지가
  // 다음 오픈으로 새어 나오면 사용자 혼란을 일으키므로 명시적으로 리셋한다.
  useEffect(() => {
    if (!isOpen) return;
    setNewName('');
    setErrorMsg(NO_ERROR);
    setEditingId(null);
    setEditName('');
    setBusy(false);
    void reloadCategories();
    // reloadCategories 는 클로저로 최신 setter 를 참조하므로 deps 에서 제외.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 편집 중 자기 자신을 제외한 "기존 이름 집합" — 편집 시 canAddCategory
  // 사전 검사에 사용한다. useMemo 로 categories/editingId 가 바뀔 때만 재계산.
  const otherNames = useMemo<string[]>(() => {
    if (editingId === null) return categories.map((c) => c.Wed_name);
    return categories
      .filter((c) => c.Wed_id !== editingId)
      .map((c) => c.Wed_name);
  }, [categories, editingId]);

  // isOpen=false 이면 완전한 no-op — 오버레이도 렌더하지 않는다.
  if (!isOpen) return null;

  // -----------------------------------------------------------------
  // Add 흐름
  // -----------------------------------------------------------------
  async function handleAdd() {
    if (busy) return;
    setErrorMsg(NO_ERROR);

    const trimmed = newName.trim();
    if (trimmed.length === 0) {
      // 빈 이름은 유의미하지 않으므로 조용히 무시 — 별도 안내 없이 리턴한다.
      // (Property 10 은 이름 공백 여부를 요구사항으로 정의하지 않는다.)
      return;
    }

    // 로컬 사전 게이트(design.md § Category_Manager · 추가 · 대소문자·공백 trim + 원문 비교).
    const existingNames = categories.map((c) => c.Wed_name);
    if (!canAddCategory(existingNames, trimmed)) {
      setErrorMsg(ERR_CATEGORY_DUP);
      return;
    }

    setBusy(true);
    try {
      await categoryApi.create({ Wed_name: trimmed });
      // 서버 저장 성공 → 로컬 목록 재조회 + 입력 초기화.
      setNewName('');
      await reloadCategories();
      await onCategoriesChanged();
    } catch (err) {
      // categoryApi 는 unique_violation(23505)을 ERR_CATEGORY_DUP 로 사상해 준다.
      // (동시성 사이에서 로컬 게이트를 통과했으나 서버에서 실패하는 경우 방어.)
      setErrorMsg(extractMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------------------------------------------
  // Edit 흐름
  // -----------------------------------------------------------------
  function beginEdit(row: BudgetCategory) {
    setErrorMsg(NO_ERROR);
    setEditingId(row.Wed_id);
    setEditName(row.Wed_name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName('');
    setErrorMsg(NO_ERROR);
  }

  async function commitEdit(row: BudgetCategory) {
    if (busy) return;
    setErrorMsg(NO_ERROR);

    const trimmed = editName.trim();
    if (trimmed.length === 0) {
      // 빈 이름은 유효하지 않으므로 무시.
      return;
    }

    // 이름이 그대로면 서버 왕복 없이 편집 모드만 종료.
    if (trimmed === row.Wed_name) {
      cancelEdit();
      return;
    }

    // 자기 자신을 제외한 목록과 비교해 중복 여부 확인.
    if (!canAddCategory(otherNames, trimmed)) {
      setErrorMsg(ERR_CATEGORY_DUP);
      return;
    }

    setBusy(true);
    try {
      await categoryApi.update(row.Wed_id, { Wed_name: trimmed });
      setEditingId(null);
      setEditName('');
      await reloadCategories();
      await onCategoriesChanged();
    } catch (err) {
      // 실패 시 편집 상태를 유지해 사용자가 이름을 조정 후 다시 시도할 수 있다.
      setErrorMsg(extractMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------------------------------------------
  // Delete 흐름
  // -----------------------------------------------------------------
  async function handleDelete(row: BudgetCategory) {
    if (busy) return;
    setErrorMsg(NO_ERROR);

    // 1단계: 프론트가 보유한 items 로 즉시 게이트(Requirement 6.7 · 사용자 즉응성).
    if (!canDeleteCategory(items, row.Wed_name)) {
      setErrorMsg(ERR_CATEGORY_REF);
      return;
    }

    // 2단계: 서버 재확인. 프론트 items 가 오래되었을 가능성을 방어한다.
    setBusy(true);
    try {
      const count = await categoryApi.countItemsUsingCategory(row.Wed_name);
      if (count > 0) {
        setErrorMsg(ERR_CATEGORY_REF);
        return;
      }
      await categoryApi.remove(row.Wed_id);
      await reloadCategories();
      await onCategoriesChanged();
    } catch (err) {
      setErrorMsg(extractMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // -----------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------
  return (
    <div
      className="confirm-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="카테고리 관리"
    >
      <div className="category-manager-card">
        <h2 className="category-manager-title">카테고리 관리</h2>

        <ul className="category-manager-list" aria-label="카테고리 목록">
          {categories.length === 0 ? (
            <li className="category-manager-empty">등록된 카테고리가 없습니다</li>
          ) : (
            categories.map((row) => {
              const isEditing = editingId === row.Wed_id;
              return (
                <li key={row.Wed_id} className="category-manager-row">
                  {isEditing ? (
                    <input
                      className="field-input category-manager-row-input"
                      type="text"
                      aria-label={`${row.Wed_name} 이름 편집`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={busy}
                    />
                  ) : (
                    <span className="category-manager-row-name">{row.Wed_name}</span>
                  )}

                  <div className="category-manager-row-actions">
                    {isEditing ? (
                      <>
                        <PillButton
                          variant="primary"
                          onClick={() => commitEdit(row)}
                          disabled={busy}
                        >
                          저장
                        </PillButton>
                        <PillButton
                          variant="secondary"
                          onClick={cancelEdit}
                          disabled={busy}
                        >
                          취소
                        </PillButton>
                      </>
                    ) : (
                      <>
                        <PillButton
                          variant="secondary"
                          onClick={() => beginEdit(row)}
                          disabled={busy || editingId !== null}
                        >
                          편집
                        </PillButton>
                        <PillButton
                          variant="secondary"
                          onClick={() => handleDelete(row)}
                          disabled={busy || editingId !== null}
                        >
                          삭제
                        </PillButton>
                      </>
                    )}
                  </div>
                </li>
              );
            })
          )}
        </ul>

        <div className="category-manager-add">
          <TextField
            label="새 카테고리 추가"
            value={newName}
            onChange={setNewName}
            disabled={busy || editingId !== null}
          />
          <PillButton
            variant="primary"
            onClick={handleAdd}
            disabled={busy || editingId !== null}
          >
            추가
          </PillButton>
        </div>

        <InlineError>{errorMsg || null}</InlineError>

        <div className="category-manager-footer">
          <PillButton variant="secondary" onClick={onClose} disabled={busy}>
            닫기
          </PillButton>
        </div>
      </div>
    </div>
  );
}
