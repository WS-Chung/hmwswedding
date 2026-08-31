-- Wedding_DB DDL
-- Wedding_Planner spec: 5 tables with `Wed_` prefix, RLS enabled with anon policies,
-- and initial Budget_Category seeding.
-- All identifiers are quoted to preserve exact `Wed_*` casing in Postgres.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) Wed_Schedule
--    일정 페이지에서 사용하는 일정 레코드.
--    Requirement 2.13: columns = Wed_date, Wed_place, Wed_time, Wed_schedule, Wed_note.
-- ---------------------------------------------------------------------------
create table if not exists "Wed_Schedule" (
  "Wed_id"         uuid        primary key default gen_random_uuid(),
  "Wed_date"       date        not null,
  "Wed_place"      text        not null,
  "Wed_time"       time        null,
  "Wed_schedule"   text        not null,
  "Wed_note"       text        null,
  "Wed_created_at" timestamptz not null default now()
);
create index if not exists "Wed_Schedule_date_idx" on "Wed_Schedule" ("Wed_date");

-- ---------------------------------------------------------------------------
-- 2) Wed_Decision
--    결정사항 페이지에서 사용하는 결정 레코드.
-- ---------------------------------------------------------------------------
create table if not exists "Wed_Decision" (
  "Wed_id"          uuid        primary key default gen_random_uuid(),
  "Wed_item"        text        not null,
  "Wed_stakeholder" text        null,
  "Wed_expense"     text        null,   -- 추가지출 여부: '있음' | '없음' | NULL
  "Wed_link"        text        null,
  "Wed_comment"     text        null,
  "Wed_created_at"  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3) Wed_Budget_Category (마스터)
--    예산관리에서 사용하는 대분류 마스터.
-- ---------------------------------------------------------------------------
create table if not exists "Wed_Budget_Category" (
  "Wed_id"         uuid        primary key default gen_random_uuid(),
  "Wed_name"       text        not null unique,
  "Wed_created_at" timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 4) Wed_Budget_Item
--    예산관리 페이지에서 사용하는 개별 예산 항목.
--    Requirement 5.9: 결제금액은 0 이상의 정수만 허용 → DB CHECK 제약.
-- ---------------------------------------------------------------------------
create table if not exists "Wed_Budget_Item" (
  "Wed_id"           uuid        primary key default gen_random_uuid(),
  "Wed_category"     text        not null,
  "Wed_item_name"    text        null,
  "Wed_payer"        text        null,
  "Wed_amount"       numeric     not null check ("Wed_amount" >= 0),
  "Wed_due_date"     date        null,
  "Wed_pay_method"   text        null,
  "Wed_vendor"       text        null,
  "Wed_note"         text        null,
  "Wed_created_at"   timestamptz not null default now()
);
create index if not exists "Wed_Budget_Item_category_idx" on "Wed_Budget_Item" ("Wed_category");

-- ---------------------------------------------------------------------------
-- 5) Wed_Contact
--    연락처 페이지에서 사용하는 연락처 레코드.
--    Requirement 8.7: 전화번호는 자유 형식 문자열, 정규화 없이 원문 저장.
-- ---------------------------------------------------------------------------
create table if not exists "Wed_Contact" (
  "Wed_id"         uuid        primary key default gen_random_uuid(),
  "Wed_company"    text        not null,
  "Wed_manager"    text        null,
  "Wed_phone"      text        null,
  "Wed_email"      text        null,
  "Wed_note"       text        null,
  "Wed_created_at" timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 6) Wed_Travel
--    여행준비 페이지에서 사용하는 여행 준비 항목.
--    컬럼: 가방(필수) · 항목(필수) · 금액(0 이상 정수, 선택) · 링크(선택) · 설명(선택).
--
--    Wed_bag 은 항목이 담기는 수하물(카드)을 가리킨다. 앱은 정확히 4장의
--    카드를 렌더하며 다음 4개 값만 사용한다(src/features/travel/bags.ts):
--      'hyemin_carrier' 혜민 캐리어   (큰 카드)
--      'hyemin_cabin'   혜민 기내가방 (작은 카드)
--      'unseok_carrier' 운석 캐리어   (큰 카드)
--      'unseok_cabin'   운석 기내가방 (작은 카드)
--    표시 라벨은 앱에서만 관리하므로 문구 변경 시 DB 변경은 필요 없다.
-- ---------------------------------------------------------------------------
create table if not exists "Wed_Travel" (
  "Wed_id"         uuid        primary key default gen_random_uuid(),
  "Wed_bag"        text        not null default 'hyemin_carrier',
  "Wed_item"       text        not null,
  "Wed_amount"     numeric     null check ("Wed_amount" >= 0),
  "Wed_link"       text        null,
  "Wed_note"       text        null,
  "Wed_created_at" timestamptz not null default now()
);
create index if not exists "Wed_Travel_bag_idx" on "Wed_Travel" ("Wed_bag");

-- ---------------------------------------------------------------------------
-- 초기 시딩 (Requirement 6.1): 6개의 카테고리.
-- 재실행 시 중복 삽입을 방지하기 위해 on conflict 사용.
-- ---------------------------------------------------------------------------
insert into "Wed_Budget_Category" ("Wed_name") values
  ('웨딩홀'), ('스드메'), ('신혼여행'), ('한복'),
  ('예물'),  ('기타')
on conflict ("Wed_name") do nothing;

-- ---------------------------------------------------------------------------
-- RLS 활성화 (Requirement 9.7): 대상 테이블 전부.
-- ---------------------------------------------------------------------------
alter table "Wed_Schedule"        enable row level security;
alter table "Wed_Decision"        enable row level security;
alter table "Wed_Budget_Category" enable row level security;
alter table "Wed_Budget_Item"     enable row level security;
alter table "Wed_Contact"         enable row level security;
alter table "Wed_Travel"          enable row level security;

-- ---------------------------------------------------------------------------
-- Anon 역할에 대해 SELECT / INSERT / UPDATE / DELETE 정책을 생성한다.
-- 재실행 안전성을 위해 각 정책을 drop → create 한다.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'Wed_Schedule','Wed_Decision','Wed_Budget_Category','Wed_Budget_Item','Wed_Contact','Wed_Travel'
  ]) loop
    execute format('drop policy if exists %I on %I', t || '_anon_select', t);
    execute format('drop policy if exists %I on %I', t || '_anon_insert', t);
    execute format('drop policy if exists %I on %I', t || '_anon_update', t);
    execute format('drop policy if exists %I on %I', t || '_anon_delete', t);

    execute format(
      'create policy %I on %I for select to anon using (true)',
      t || '_anon_select', t
    );
    execute format(
      'create policy %I on %I for insert to anon with check (true)',
      t || '_anon_insert', t
    );
    execute format(
      'create policy %I on %I for update to anon using (true) with check (true)',
      t || '_anon_update', t
    );
    execute format(
      'create policy %I on %I for delete to anon using (true)',
      t || '_anon_delete', t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 마이그레이션 (이미 배포된 DB용).
--   `create table if not exists`는 기존 테이블 컬럼을 변경하지 않으므로,
--   운영 중인 Supabase에 아래 ALTER 문을 실행해 스키마를 최신화한다.
--   모두 idempotent(재실행 안전)하다.
--     - 상품명(Wed_product_name) 제거      → 항목명만 유지
--     - 할부여부(Wed_installment) 제거
--     - 결제자(Wed_payer) 추가             → 값은 앱에서 '혜민' | '운석'로 제한
-- ---------------------------------------------------------------------------
alter table "Wed_Budget_Item" add    column if not exists "Wed_payer" text null;
alter table "Wed_Budget_Item" drop   column if exists     "Wed_product_name";
alter table "Wed_Budget_Item" drop   column if exists     "Wed_installment";

-- 결정사항의 '지출'(numeric 금액) → '추가지출'(있음/없음 텍스트)로 의미 변경.
--   numeric → text 로 컬럼 타입을 전환한다. 기존 숫자 값은 문자열로 캐스팅된다.
alter table "Wed_Decision"
  alter column "Wed_expense" type text using "Wed_expense"::text;

-- 예산 카테고리에서 '가전', '가구' 제거.
--   해당 카테고리를 사용하는 예산 항목이 있으면 먼저 처리(이동/삭제)해야 한다.
--   (사용 중인 항목이 없을 때만 아래 삭제가 정상 수행된다.)
delete from "Wed_Budget_Category" where "Wed_name" in ('가전', '가구');

-- 여행준비 페이지용 Wed_Travel 테이블 신규 생성 + RLS + anon 정책.
--   (이미 배포된 DB에 아래 블록 전체를 실행하면 된다. 재실행 안전.)
create table if not exists "Wed_Travel" (
  "Wed_id"         uuid        primary key default gen_random_uuid(),
  "Wed_bag"        text        not null default 'hyemin_carrier',
  "Wed_item"       text        not null,
  "Wed_amount"     numeric     null check ("Wed_amount" >= 0),
  "Wed_link"       text        null,
  "Wed_note"       text        null,
  "Wed_created_at" timestamptz not null default now()
);
alter table "Wed_Travel" enable row level security;
do $$
begin
  execute 'drop policy if exists "Wed_Travel_anon_select" on "Wed_Travel"';
  execute 'drop policy if exists "Wed_Travel_anon_insert" on "Wed_Travel"';
  execute 'drop policy if exists "Wed_Travel_anon_update" on "Wed_Travel"';
  execute 'drop policy if exists "Wed_Travel_anon_delete" on "Wed_Travel"';
  execute 'create policy "Wed_Travel_anon_select" on "Wed_Travel" for select to anon using (true)';
  execute 'create policy "Wed_Travel_anon_insert" on "Wed_Travel" for insert to anon with check (true)';
  execute 'create policy "Wed_Travel_anon_update" on "Wed_Travel" for update to anon using (true) with check (true)';
  execute 'create policy "Wed_Travel_anon_delete" on "Wed_Travel" for delete to anon using (true)';
end $$;

-- ---------------------------------------------------------------------------
-- 여행준비 4카드(혜민/운석 × 캐리어/기내가방) 도입에 따른 Wed_Travel 확장.
--
--   이미 배포된 DB에는 `create table if not exists`가 컬럼을 추가하지 않으므로
--   아래 두 문장을 Supabase SQL Editor에서 실행해야 한다. 둘 다 idempotent다.
--
--   기존 행은 DEFAULT 값('hyemin_carrier')을 갖게 되어 "혜민 캐리어" 카드에
--   모두 표시된다. 다른 카드로 옮기려면 UPDATE로 Wed_bag 값을 바꾸면 된다.
--     허용 값: 'hyemin_carrier' | 'hyemin_cabin' | 'unseok_carrier' | 'unseok_cabin'
-- ---------------------------------------------------------------------------
alter table "Wed_Travel"
  add column if not exists "Wed_bag" text not null default 'hyemin_carrier';

create index if not exists "Wed_Travel_bag_idx" on "Wed_Travel" ("Wed_bag");

-- 참고: 표 좌측의 "챔김" 체크박스(취소선 표시)는 화면 전용 상태이며 DB에
--   저장하지 않는다. 따라서 이를 위한 컬럼은 존재하지 않는다.
