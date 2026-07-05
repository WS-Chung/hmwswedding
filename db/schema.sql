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
  "Wed_expense"     numeric     null,
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
-- 초기 시딩 (Requirement 6.1): 정확히 8개의 카테고리.
-- 재실행 시 중복 삽입을 방지하기 위해 on conflict 사용.
-- ---------------------------------------------------------------------------
insert into "Wed_Budget_Category" ("Wed_name") values
  ('웨딩홀'), ('스드메'), ('신혼여행'), ('한복'),
  ('예물'),  ('기타'),   ('가전'),     ('가구')
on conflict ("Wed_name") do nothing;

-- ---------------------------------------------------------------------------
-- RLS 활성화 (Requirement 9.7): 다섯 테이블 전부.
-- ---------------------------------------------------------------------------
alter table "Wed_Schedule"        enable row level security;
alter table "Wed_Decision"        enable row level security;
alter table "Wed_Budget_Category" enable row level security;
alter table "Wed_Budget_Item"     enable row level security;
alter table "Wed_Contact"         enable row level security;

-- ---------------------------------------------------------------------------
-- Anon 역할에 대해 SELECT / INSERT / UPDATE / DELETE 정책을 생성한다.
-- 재실행 안전성을 위해 각 정책을 drop → create 한다.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'Wed_Schedule','Wed_Decision','Wed_Budget_Category','Wed_Budget_Item','Wed_Contact'
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
