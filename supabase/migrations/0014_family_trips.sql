-- 가족 여행 플래너: 가족 단위로 공유되는 여행 / 일정 편집본 / 장소별 진행 기록.
-- 여행은 가족 구성원 모두가 읽고 쓰는 공유 데이터다 (diary_entries 같은
-- private-first 모델이 아님). 사진 파일은 이 마이그레이션 범위 밖 -- storage
-- RLS와 짝으로 설계해야 하므로 별도 작업으로 둔다.

-- 가족 소속 여부 헬퍼. families를 직접 서브쿼리하면 RLS가 재귀되므로
-- is_family_member()와 같은 방식으로 SECURITY DEFINER로 감싼다.
create or replace function is_in_family(fid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from family_members fm
    where fm.family_id = fid and fm.user_id = uid and fm.status = 'active'
  );
$$;

create table trips (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families (id) on delete cascade,
  created_by uuid not null references profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  -- 여행 정의: days / places / plans / mandatory (docs: 앱의 trip-engine 스키마)
  def jsonb not null check (jsonb_typeof(def) = 'object' and octet_length(def::text) <= 300000),
  start_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index trips_family_idx on trips (family_id, created_at desc);
create index trips_created_by_idx on trips (created_by);

-- 일차별 일정 편집본. 없으면 def.plans[plan].days[day]의 기본 일정을 쓴다.
create table trip_day_items (
  trip_id uuid not null references trips (id) on delete cascade,
  plan_id text not null check (char_length(plan_id) between 1 and 60),
  day integer not null check (day between 1 and 30),
  items jsonb not null check (jsonb_typeof(items) = 'array' and octet_length(items::text) <= 100000),
  updated_by uuid not null references profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (trip_id, plan_id, day)
);

create index trip_day_items_updated_by_idx on trip_day_items (updated_by);

-- 장소(일정 항목)별 진행 기록. 대안(plan)이 바뀌어도 같은 item_id면 기록이 유지된다.
create table trip_progress (
  trip_id uuid not null references trips (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 80),
  status text check (status in ('arrived', 'done', 'skipped')),
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object' and octet_length(checks::text) <= 4000),
  memo text not null default '' check (char_length(memo) <= 2000),
  cost integer check (cost is null or cost between 0 and 100000000),
  updated_by uuid not null references profiles (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (trip_id, item_id)
);

create index trip_progress_updated_by_idx on trip_progress (updated_by);

create or replace function is_trip_member(tid uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from trips t
    join family_members fm on fm.family_id = t.family_id
    where t.id = tid and fm.user_id = uid and fm.status = 'active'
  );
$$;

alter table trips enable row level security;
alter table trip_day_items enable row level security;
alter table trip_progress enable row level security;

-- 명령별로 정책 하나씩 (0011의 통합 원칙: permissive 정책 중복 평가 방지)
create policy "trips: family can read" on trips
  for select using (is_in_family(family_id, (select auth.uid())));

create policy "trips: family can create" on trips
  for insert with check (
    created_by = (select auth.uid()) and is_in_family(family_id, (select auth.uid()))
  );

create policy "trips: family can update" on trips
  for update using (is_in_family(family_id, (select auth.uid())))
  with check (is_in_family(family_id, (select auth.uid())));

-- 삭제는 만든 사람만 (가족 여행을 실수로 지우는 것 방지)
create policy "trips: creator can delete" on trips
  for delete using (created_by = (select auth.uid()));

create policy "trip_day_items: family can read" on trip_day_items
  for select using (is_trip_member(trip_id, (select auth.uid())));

create policy "trip_day_items: family can insert" on trip_day_items
  for insert with check (updated_by = (select auth.uid()) and is_trip_member(trip_id, (select auth.uid())));

create policy "trip_day_items: family can update" on trip_day_items
  for update using (is_trip_member(trip_id, (select auth.uid())))
  with check (updated_by = (select auth.uid()) and is_trip_member(trip_id, (select auth.uid())));

create policy "trip_day_items: family can delete" on trip_day_items
  for delete using (is_trip_member(trip_id, (select auth.uid())));

create policy "trip_progress: family can read" on trip_progress
  for select using (is_trip_member(trip_id, (select auth.uid())));

create policy "trip_progress: family can insert" on trip_progress
  for insert with check (updated_by = (select auth.uid()) and is_trip_member(trip_id, (select auth.uid())));

create policy "trip_progress: family can update" on trip_progress
  for update using (is_trip_member(trip_id, (select auth.uid())))
  with check (updated_by = (select auth.uid()) and is_trip_member(trip_id, (select auth.uid())));

create policy "trip_progress: family can delete" on trip_progress
  for delete using (is_trip_member(trip_id, (select auth.uid())));

-- 헬퍼 함수는 로그인한 사용자만 호출 (RLS 평가에 필요)
revoke execute on function is_in_family(uuid, uuid) from public, anon;
revoke execute on function is_trip_member(uuid, uuid) from public, anon;
grant execute on function is_in_family(uuid, uuid) to authenticated;
grant execute on function is_trip_member(uuid, uuid) to authenticated;

-- trips UPDATE 정책은 행 단위라 created_by / family_id 변경을 막지 못한다.
-- 그대로 두면 가족 누구나 created_by를 자기로 바꿔 "만든 사람만 삭제" 규칙을
-- 우회하거나 여행을 다른 가족으로 옮길 수 있다. 수정 가능한 컬럼만 허용한다.
revoke update on trips from authenticated, anon;
grant update (title, def, start_date, updated_at) on trips to authenticated;
