-- 하루별 (Family Growth Diary) — initial schema
-- Family-private tool. Private-first: an entry is visible only to its
-- author unless explicitly shared with the family (visibility = 'family').

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- families / membership
-- ---------------------------------------------------------------------------

create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text unique not null default upper(substr(md5(random()::text), 1, 6)),
  created_at timestamptz not null default now()
);

-- looks up a family by its short invite code without exposing the rest of
-- the families table to unauthenticated/unrelated users via RLS
create or replace function find_family_by_invite_code(code text)
returns table (id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select id, name from families where invite_code = upper(code);
$$;

grant execute on function find_family_by_invite_code(text) to authenticated;

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table family_members (
  family_id uuid not null references families (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('parent', 'child')),
  status text not null default 'active' check (status in ('active', 'invited', 'removed')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- helper: is `uid` a member of the same family as `entry_owner`?
create or replace function is_family_member(entry_owner uuid, uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from family_members fm_owner
    join family_members fm_viewer
      on fm_viewer.family_id = fm_owner.family_id
    where fm_owner.user_id = entry_owner
      and fm_viewer.user_id = uid
      and fm_owner.status = 'active'
      and fm_viewer.status = 'active'
  );
$$;

-- ---------------------------------------------------------------------------
-- diary entries / media / reactions / comments
-- ---------------------------------------------------------------------------

create type diary_category as enum ('achieved', 'brave', 'discovered', 'grateful', 'growing');
create type visibility_level as enum ('private', 'family');

create table diary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  entry_date date not null,
  category diary_category not null,
  mood text,
  content text not null,
  visibility visibility_level not null default 'private',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index diary_entries_user_date_idx on diary_entries (user_id, entry_date desc);

create table media (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references diary_entries (id) on delete cascade,
  type text not null default 'photo' check (type in ('photo')),
  visibility visibility_level not null default 'private',
  original_path text not null,
  display_path text,
  thumbnail_path text,
  mime_type text,
  width int,
  height int,
  size_original int,
  size_display int,
  sha256 text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index media_entry_idx on media (entry_id);

create table reactions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references diary_entries (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (entry_id, user_id, emoji)
);

create table comments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references diary_entries (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: private-first
-- ---------------------------------------------------------------------------

alter table families enable row level security;
alter table profiles enable row level security;
alter table family_members enable row level security;
alter table diary_entries enable row level security;
alter table media enable row level security;
alter table reactions enable row level security;
alter table comments enable row level security;

create policy "member can read own family" on families
  for select using (
    exists (select 1 from family_members fm where fm.family_id = id and fm.user_id = auth.uid())
  );

create policy "profiles readable by family members" on profiles
  for select using (is_family_member(id, auth.uid()) or id = auth.uid());

create policy "profile self update" on profiles
  for update using (id = auth.uid());

create policy "profiles insert self" on profiles
  for insert with check (id = auth.uid());

create policy "family create" on families
  for insert with check (auth.uid() is not null);

create policy "family_members insert self" on family_members
  for insert with check (user_id = auth.uid());

create policy "family members readable within family" on family_members
  for select using (is_family_member(user_id, auth.uid()));

create policy "entries: owner full access" on diary_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "entries: family can read shared" on diary_entries
  for select using (visibility = 'family' and is_family_member(user_id, auth.uid()));

create policy "media: owner full access" on media
  for all using (
    exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = auth.uid())
  ) with check (
    exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = auth.uid())
  );

create policy "media: family can read shared" on media
  for select using (
    visibility = 'family'
    and exists (
      select 1 from diary_entries e
      where e.id = entry_id and is_family_member(e.user_id, auth.uid())
    )
  );

create policy "reactions: family can read" on reactions
  for select using (
    exists (
      select 1 from diary_entries e
      where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, auth.uid())
    )
  );

create policy "reactions: family can react" on reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from diary_entries e
      where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, auth.uid())
    )
  );

create policy "reactions: owner can delete own reaction" on reactions
  for delete using (user_id = auth.uid());

create policy "comments: family can read" on comments
  for select using (
    exists (
      select 1 from diary_entries e
      where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, auth.uid())
    )
  );

create policy "comments: family can write" on comments
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from diary_entries e
      where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, auth.uid())
    )
  );

create policy "comments: author can update/delete own" on comments
  for update using (user_id = auth.uid());

create policy "comments: author can delete own" on comments
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- storage: private bucket for diary media
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('diary-media', 'diary-media', false)
on conflict (id) do nothing;

create policy "diary-media: owner can manage own folder"
  on storage.objects for all
  using (bucket_id = 'diary-media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'diary-media' and (storage.foldername(name))[1] = auth.uid()::text);
