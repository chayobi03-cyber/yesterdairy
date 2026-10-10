-- 장소별 댓글. 메모(trip_progress.memo)는 한 칸을 같이 고쳐 누가 썼는지 알 수 없고 나중에 쓴
-- 사람이 덮어쓸 수 있어서, 작성자와 시각이 남는 댓글 형태를 추가한다. 기존 memo는 그대로 둔다.

create table trip_comments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  item_id text not null check (char_length(item_id) between 1 and 80),
  body text not null check (char_length(body) between 1 and 1000),
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index trip_comments_trip_idx on trip_comments (trip_id, item_id, created_at);
create index trip_comments_created_by_idx on trip_comments (created_by);

alter table trip_comments enable row level security;

create policy "trip_comments: family can read" on trip_comments
  for select using (is_trip_member(trip_id, (select auth.uid())));

create policy "trip_comments: family can insert" on trip_comments
  for insert with check (created_by = (select auth.uid()) and is_trip_member(trip_id, (select auth.uid())));

-- 쓴 사람 또는 여행을 만든 사람이 지울 수 있다 (수정은 지우고 다시 쓰기)
create policy "trip_comments: author or creator can delete" on trip_comments
  for delete using (
    created_by = (select auth.uid())
    or exists (select 1 from trips t where t.id = trip_id and t.created_by = (select auth.uid()))
  );
