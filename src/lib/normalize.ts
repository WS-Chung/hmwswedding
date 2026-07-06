/**
 * Domain normalization pure functions for Wedding_Planner form input.
 *
 * These functions bridge raw form state (all fields typed as strings) and the
 * DB-facing `Wed_*` payload shape (typed with `null` for absent optional
 * columns). Every function follows the same contract:
 *
 *   - Accepts a raw form-input object where each field is a `string`
 *     (optional, so partially-filled state is safe to pass).
 *   - Returns a discriminated union `NormalizeResult<T>`:
 *       * `{ ok: true,  value }` when every required field is present and
 *         all validators pass — `value` is ready to hand to the `*Api.ts`
 *         create/update calls.
 *       * `{ ok: false, errors }` when any required field is empty or a
 *         validator (e.g. `isValidAmount`, `isValidEmail`) rejects an
 *         entered value. `errors` is a non-empty list of user-facing
 *         messages so callers can surface an `<InlineError />`.
 *
 * Normalization rules (Property 14, Requirement 8.7):
 *
 *   (a) Optional string columns: input that is empty or contains only
 *       whitespace becomes `null` in the payload.
 *   (b) Required fields (per domain): empty/whitespace input triggers an
 *       error and the save gate rejects the request.
 *   (c) `Wed_phone` in `normalizeContact` is the SINGLE EXCEPTION to rule
 *       (a). Requirement 8.7 / Property 16 mandate that the phone value be
 *       stored character-identically to the user input (no trim, no null
 *       coercion, no hyphenation), so this function passes the string
 *       through as-is.
 *   (d) Numeric fields (`Wed_expense`, `Wed_amount`) are parsed with
 *       `Number(...)` and validated with `isValidAmount` — non-integer,
 *       negative, or non-finite values return an error.
 *   (e) Email input is validated with `isValidEmail` only when a value was
 *       actually entered (Requirement 8.6).
 *
 * Domain required-field sets (Property 14 (b), tasks.md § 6.1):
 *
 *   Schedule    → Wed_date, Wed_place, Wed_time, Wed_schedule
 *   Decision    → Wed_item
 *   BudgetItem  → Wed_category, Wed_amount
 *   Contact     → Wed_company
 *
 * Requirements covered: 2.13, 2.14, 3.6, 5.7, 5.8, 8.5, 8.7
 */

import { isValidAmount, isValidEmail } from './validators';

// ────────────────────────────────────────────────────────────────────────────
// Shared types & helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Discriminated union returned by every `normalize*` function.
 * The `ok` flag lets callers narrow safely to `value` or `errors`.
 */
export type NormalizeResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

/**
 * Read a form-input string field, defaulting `undefined`/`null` to `""` so
 * downstream checks can treat "absent" and "empty" uniformly.
 */
function readField(x: string | null | undefined): string {
  return typeof x === 'string' ? x : '';
}

/**
 * Returns `true` when `x` contains at least one non-whitespace character.
 *
 * Used for "field is present" checks on required inputs. This does NOT
 * modify the stored value — the original string (including any surrounding
 * whitespace) is preserved in the normalized payload.
 */
function isPresent(x: string): boolean {
  return x.trim().length > 0;
}

/**
 * Optional-string normalization: empty or whitespace-only input → `null`,
 * otherwise the original string is returned unchanged (no trimming applied
 * to the retained value).
 *
 * Implements Property 14 (a) for every optional string column EXCEPT
 * `Wed_phone`, which is handled with a raw identity assignment in
 * `normalizeContact` per Requirement 8.7 / Property 16.
 */
function emptyToNull(x: string): string | null {
  return isPresent(x) ? x : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Schedule
// ────────────────────────────────────────────────────────────────────────────

/** Raw form input for the "일정 추가" form (AddScheduleForm). */
export type ScheduleFormInput = {
  Wed_date?: string;
  Wed_place?: string;
  Wed_time?: string;
  Wed_schedule?: string;
  Wed_note?: string;
};

/** Normalized payload ready for `scheduleApi.create` / `scheduleApi.update`. */
export type NormalizedSchedule = {
  Wed_date: string;
  Wed_place: string;
  Wed_time: string;
  Wed_schedule: string;
  Wed_note: string | null;
};

/**
 * Normalize an AddScheduleForm submission for `Wed_Schedule`.
 *
 * Required: `Wed_date`, `Wed_place`, `Wed_time`, `Wed_schedule` (일정내용).
 * Optional: `Wed_note` (메모) — empty/whitespace becomes `null`.
 *
 * Validates: Requirements 2.13, 2.14 (Property 14 · Schedule 도메인).
 */
export function normalizeSchedule(
  input: ScheduleFormInput,
): NormalizeResult<NormalizedSchedule> {
  const date = readField(input.Wed_date);
  const place = readField(input.Wed_place);
  const time = readField(input.Wed_time);
  const schedule = readField(input.Wed_schedule);
  const note = readField(input.Wed_note);

  const errors: string[] = [];
  if (!isPresent(date)) errors.push('날짜를 입력해주세요');
  if (!isPresent(place)) errors.push('장소를 입력해주세요');
  if (!isPresent(time)) errors.push('시간을 입력해주세요');
  if (!isPresent(schedule)) errors.push('일정내용을 입력해주세요');

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      Wed_date: date,
      Wed_place: place,
      Wed_time: time,
      Wed_schedule: schedule,
      Wed_note: emptyToNull(note),
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Decision
// ────────────────────────────────────────────────────────────────────────────

/** 결정사항 도메인 입력 제한. */
export const DECISION_ITEM_MAX = 10 as const;
export const DECISION_COMMENT_MAX = 200 as const;

/** Raw form input for the DecisionPage inline editor / add row. */
export type DecisionFormInput = {
  Wed_item?: string;
  Wed_stakeholder?: string;
  /** 추가지출 여부 드롭다운 값('있음' | '없음' | ''). */
  Wed_expense?: string;
  Wed_link?: string;
  Wed_comment?: string;
};

/** Normalized payload ready for `decisionApi.create` / `decisionApi.update`. */
export type NormalizedDecision = {
  Wed_item: string;
  Wed_stakeholder: string | null;
  Wed_expense: string | null;
  Wed_link: string | null;
  Wed_comment: string | null;
};

/**
 * Normalize a DecisionPage row submission for `Wed_Decision`.
 *
 * Required: `Wed_item` (항목).
 * Optional: `Wed_stakeholder`, `Wed_expense`, `Wed_link`, `Wed_comment` —
 * empty/whitespace inputs become `null`. `Wed_expense` additionally must
 * parse (via `Number(...)`) to a non-negative safe integer when provided;
 * `isValidAmount` gates the numeric shape (Requirement 3.5 · 원 단위 정수).
 *
 * Validates: Requirements 3.6 (Property 14 · Decision 도메인).
 */
export function normalizeDecision(
  input: DecisionFormInput,
): NormalizeResult<NormalizedDecision> {
  const item = readField(input.Wed_item);
  const stakeholder = readField(input.Wed_stakeholder);
  const expense = readField(input.Wed_expense);
  const link = readField(input.Wed_link);
  const comment = readField(input.Wed_comment);

  const errors: string[] = [];
  if (!isPresent(item)) errors.push('항목을 입력해주세요');
  else if (item.length > DECISION_ITEM_MAX)
    errors.push(`항목은 ${DECISION_ITEM_MAX}자 이내로 입력해주세요`);

  if (comment.length > DECISION_COMMENT_MAX)
    errors.push(`코멘트는 ${DECISION_COMMENT_MAX}자 이내로 입력해주세요`);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      Wed_item: item,
      Wed_stakeholder: emptyToNull(stakeholder),
      Wed_expense: emptyToNull(expense),
      Wed_link: emptyToNull(link),
      Wed_comment: emptyToNull(comment),
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Budget_Item
// ────────────────────────────────────────────────────────────────────────────

/** Raw form input for the BudgetItemTable add/edit row. */
export type BudgetItemFormInput = {
  Wed_category?: string;
  Wed_item_name?: string;
  Wed_payer?: string;
  /** Numeric text ("120000") — parsed to a non-negative integer in the payload. */
  Wed_amount?: string;
  Wed_due_date?: string;
  Wed_pay_method?: string;
  Wed_vendor?: string;
  Wed_note?: string;
};

/** Normalized payload ready for `budgetApi.create` / `budgetApi.update`. */
export type NormalizedBudgetItem = {
  Wed_category: string;
  Wed_item_name: string | null;
  Wed_payer: string | null;
  Wed_amount: number;
  Wed_due_date: string | null;
  Wed_pay_method: string | null;
  Wed_vendor: string | null;
  Wed_note: string | null;
};

/**
 * Normalize a BudgetItemTable row submission for `Wed_Budget_Item`.
 *
 * Required: `Wed_category` (드롭다운 선택), `Wed_amount` (결제금액).
 * Optional: all other columns — empty/whitespace inputs become `null`.
 * `Wed_amount` must parse to a non-negative safe integer via `isValidAmount`
 * (Requirement 5.9).
 *
 * Validates: Requirements 5.7, 5.8 (Property 14 · Budget_Item 도메인).
 */
export function normalizeBudgetItem(
  input: BudgetItemFormInput,
): NormalizeResult<NormalizedBudgetItem> {
  const category = readField(input.Wed_category);
  const itemName = readField(input.Wed_item_name);
  const payer = readField(input.Wed_payer);
  const amountRaw = readField(input.Wed_amount);
  const dueDate = readField(input.Wed_due_date);
  const payMethod = readField(input.Wed_pay_method);
  const vendor = readField(input.Wed_vendor);
  const note = readField(input.Wed_note);

  const errors: string[] = [];
  if (!isPresent(category)) errors.push('카테고리를 선택해주세요');

  let amount: number | null = null;
  if (!isPresent(amountRaw)) {
    errors.push('결제금액을 입력해주세요');
  } else {
    const parsed = Number(amountRaw);
    if (!isValidAmount(parsed)) {
      errors.push('결제금액은 0 이상의 정수여야 합니다');
    } else {
      amount = parsed;
    }
  }

  if (errors.length > 0 || amount === null) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      Wed_category: category,
      Wed_item_name: emptyToNull(itemName),
      Wed_payer: emptyToNull(payer),
      Wed_amount: amount,
      Wed_due_date: emptyToNull(dueDate),
      Wed_pay_method: emptyToNull(payMethod),
      Wed_vendor: emptyToNull(vendor),
      Wed_note: emptyToNull(note),
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Contact
// ────────────────────────────────────────────────────────────────────────────

/** Raw form input for the ContactPage add/edit row. */
export type ContactFormInput = {
  Wed_company?: string;
  Wed_manager?: string;
  /**
   * VERBATIM: stored character-identically with the user input. No trim, no
   * hyphen insertion, no null coercion on whitespace-only strings.
   * (Requirement 8.7 / Property 16)
   */
  Wed_phone?: string;
  Wed_email?: string;
  Wed_note?: string;
};

/** Normalized payload ready for `contactApi.create` / `contactApi.update`. */
export type NormalizedContact = {
  Wed_company: string;
  Wed_manager: string | null;
  /** Verbatim identity of the user-entered phone string (Property 16). */
  Wed_phone: string;
  Wed_email: string | null;
  Wed_note: string | null;
};

/**
 * Normalize a ContactPage row submission for `Wed_Contact`.
 *
 * Required: `Wed_company` (업체).
 * Optional: `Wed_manager`, `Wed_email`, `Wed_note` — empty/whitespace inputs
 * become `null`. `Wed_email`, when non-empty, must satisfy `isValidEmail`.
 *
 * SPECIAL CASE — `Wed_phone`: stored character-identically to the input.
 * Whitespace, empty strings, and arbitrary formatting are all preserved as
 * entered (Requirement 8.7, Property 16). No trim, no normalization.
 *
 * Validates: Requirements 8.5, 8.7 (Property 14 · Contact 도메인 + Property 16).
 */
export function normalizeContact(
  input: ContactFormInput,
): NormalizeResult<NormalizedContact> {
  const company = readField(input.Wed_company);
  const manager = readField(input.Wed_manager);
  // NOTE: intentional identity read — `Wed_phone` is preserved verbatim
  // (Requirement 8.7). We use `readField` only to coerce undefined → ""
  // so the return type stays `string`; any actual string input flows
  // through unchanged (Property 16).
  const phone = readField(input.Wed_phone);
  const email = readField(input.Wed_email);
  const note = readField(input.Wed_note);

  const errors: string[] = [];
  if (!isPresent(company)) errors.push('업체를 입력해주세요');

  if (isPresent(email) && !isValidEmail(email)) {
    errors.push('올바른 이메일 형식이 아닙니다');
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      Wed_company: company,
      Wed_manager: emptyToNull(manager),
      Wed_phone: phone,
      Wed_email: emptyToNull(email),
      Wed_note: emptyToNull(note),
    },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Travel
// ────────────────────────────────────────────────────────────────────────────

/** Raw form input for the TravelPage add/edit row. */
export type TravelFormInput = {
  Wed_item?: string;
  /** Numeric text ("120000") — parsed to a non-negative integer or `null`. */
  Wed_amount?: string;
  Wed_link?: string;
  Wed_note?: string;
};

/** Normalized payload ready for `travelApi.create` / `travelApi.update`. */
export type NormalizedTravel = {
  Wed_item: string;
  Wed_amount: number | null;
  Wed_link: string | null;
  Wed_note: string | null;
};

/**
 * Normalize a TravelPage row submission for `Wed_Travel`.
 *
 * Required: `Wed_item` (항목).
 * Optional: `Wed_amount`, `Wed_link`, `Wed_note` — empty/whitespace inputs
 * become `null`. `Wed_amount`, when provided, must parse to a non-negative
 * integer via `isValidAmount`.
 */
export function normalizeTravel(
  input: TravelFormInput,
): NormalizeResult<NormalizedTravel> {
  const item = readField(input.Wed_item);
  const amountRaw = readField(input.Wed_amount);
  const link = readField(input.Wed_link);
  const note = readField(input.Wed_note);

  const errors: string[] = [];
  if (!isPresent(item)) errors.push('항목을 입력해주세요');

  let amount: number | null = null;
  if (isPresent(amountRaw)) {
    const parsed = Number(amountRaw);
    if (!isValidAmount(parsed)) {
      errors.push('금액은 0 이상의 정수여야 합니다');
    } else {
      amount = parsed;
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      Wed_item: item,
      Wed_amount: amount,
      Wed_link: emptyToNull(link),
      Wed_note: emptyToNull(note),
    },
  };
}
