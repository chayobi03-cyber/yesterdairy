-- "오늘의 색": a near-zero-friction daily check-in, deliberately kept separate
-- from diary_entries and its family-sharing model -- just "point the camera
-- at something, get today's color." No text, no category, no visibility
-- toggle. One row per user per day; retaking today's color overwrites it.
-- Color extraction happens entirely client-side (canvas pixel averaging),
-- so this costs nothing beyond one small DB row per day.
create table daily_colors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  color_date date not null,
  hex text not null check (hex ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now(),
  unique (user_id, color_date)
);

create index daily_colors_user_date_idx on daily_colors (user_id, color_date desc);

alter table daily_colors enable row level security;

-- Single SELECT policy (not a separate ALL + SELECT pair) per the
-- convention from migration 0011 -- this table has no family-read case to
-- justify a second permissive policy in the first place.
create policy "daily_colors: owner can select" on daily_colors
  for select using (user_id = (select auth.uid()));

create policy "daily_colors: owner can insert" on daily_colors
  for insert with check (user_id = (select auth.uid()));

create policy "daily_colors: owner can update" on daily_colors
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "daily_colors: owner can delete" on daily_colors
  for delete using (user_id = (select auth.uid()));
