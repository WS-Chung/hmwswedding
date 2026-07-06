/**
 * Travel_Manager 데이터 계층 (`features/travel/travelApi.ts`).
 *
 * `Wed_Travel` 테이블에 대한 CRUD를 담당하는 유일한 진입점.
 * 다른 도메인 API(decisionApi/contactApi)와 동일한 계약을 따른다:
 *   - 성공 시 도메인 타입(`TravelRecord`)을 반환한다.
 *   - 실패 시 `throw new Error(mapSupabaseError(err))`로 표준화된 사용자
 *     메시지를 던진다. 호출부는 `<InlineError />`로 그대로 노출한다.
 */

import { supabase } from '../../lib/supabaseClient';
import { mapSupabaseError } from '../../lib/errorMapping';

/** `Wed_Travel` 테이블의 한 행. */
export type TravelRecord = {
  Wed_id: string;
  Wed_item: string;
  /** 금액: 0 이상 정수 또는 NULL(선택). */
  Wed_amount: number | null;
  /** URL 또는 NULL(선택). 표에서는 "링크"로만 표시. */
  Wed_link: string | null;
  Wed_note: string | null;
  Wed_created_at: string;
};

const TABLE = 'Wed_Travel' as const;

export const travelApi = {
  async list(): Promise<TravelRecord[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('Wed_created_at', { ascending: true });

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return (data ?? []) as TravelRecord[];
  },

  async create(
    input: Omit<TravelRecord, 'Wed_id' | 'Wed_created_at'>,
  ): Promise<TravelRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(input)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as TravelRecord;
  },

  async update(
    id: string,
    patch: Partial<TravelRecord>,
  ): Promise<TravelRecord> {
    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq('Wed_id', id)
      .select()
      .single();

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
    return data as TravelRecord;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq('Wed_id', id);

    if (error) {
      throw new Error(mapSupabaseError(error));
    }
  },
};
