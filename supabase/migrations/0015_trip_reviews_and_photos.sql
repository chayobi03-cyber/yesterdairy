-- 여행 소감(별점·글)과 사진.
-- 사진은 테이블 RLS와 storage RLS를 짝으로 둔다 (docs/design-principles.md: Storage RLS는
-- 테이블 RLS와 별개). 둘 다 "그 여행의 가족 구성원" 기준이다.

-- 1) 장소별 소감. memo(계획용 공유 메모)와 구분해서, 다녀온 뒤의 느낌을 남긴다.
alter table trip_progress
  add column review text not null default '' check (char_length(review) <= 1000),
  add column rating smallint check (rating is null or rating between 1 and 5);

-- 2) 사진 메타데이터. item_id가 null이면 여행 전체 사진.
-- 파일 경로는 id로 결정되는 고정 형식이라 임의 경로를 가리킬 수 없다.
create table trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips (id) on delete cascade,
  item_id text check (item_id is null or char_length(item_id) between 1 and 80),
  path text not null,
  thumb_path text not null,
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_by uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint trip_photos_path_fixed check (
    path = trip_id::text || '/' || id::text || '.jpg'
    and thumb_path = trip_id::text || '/' || id::text || '_t.jpg'
  )
);

create index trip_photos_trip_idx on trip_photos (trip_id, created_at);
create index trip_photos_created_by_idx on trip_photos (created_by);

alter table trip_photos enable row level security;

create policy "trip_photos: family can read" on trip_photos
  for select using (is_trip_member(trip_id, (select auth.uid())));

create policy "trip_photos: family can insert" on trip_photos
  for insert with check (created_by = (select auth.uid()) and is_trip_member(trip_id, (select auth.uid())));

-- 올린 사람이나 여행을 만든 사람이 지울 수 있다
create policy "trip_photos: uploader or creator can delete" on trip_photos
  for delete using (
    created_by = (select auth.uid())
    or exists (select 1 from trips t where t.id = trip_id and t.created_by = (select auth.uid()))
  );

-- 3) storage: 비공개 버킷. 경로의 첫 폴더가 trip_id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-media', 'trip-media', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

-- 경로 첫 조각이 uuid 형식일 때만 uuid로 변환한다 (CASE는 평가 순서가 보장됨).
create or replace function is_trip_media_member(object_name text, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then is_trip_member(split_part(object_name, '/', 1)::uuid, uid)
    else false
  end;
$$;

revoke execute on function is_trip_media_member(text, uuid) from public, anon;
grant execute on function is_trip_media_member(text, uuid) to authenticated;

create policy "trip-media: family can read" on storage.objects
  for select using (bucket_id = 'trip-media' and is_trip_media_member(name, (select auth.uid())));

create policy "trip-media: family can upload" on storage.objects
  for insert with check (bucket_id = 'trip-media' and is_trip_media_member(name, (select auth.uid())));

-- 파일 삭제는 그 여행의 가족 구성원이면 가능하다. 누가 지울 수 있는지(올린 사람/만든 사람)는
-- trip_photos 행 삭제 정책이 정하고, 앱은 행을 먼저 지운 뒤 파일을 지운다.
create policy "trip-media: family can delete" on storage.objects
  for delete using (bucket_id = 'trip-media' and is_trip_media_member(name, (select auth.uid())));
