-- Goals: small personal goals (parents included, not just kids) that the
-- family can cheer on. Private-first, same as diary entries.
create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  target_date date,
  visibility visibility_level not null default 'private',
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index goals_user_idx on goals (user_id, created_at desc);

-- one cheer per person per goal -- the cheer count itself is the "bonus
-- point"; there is no cross-family ranking, just a running tally.
create table goal_cheers (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references goals (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (goal_id, user_id)
);

alter table goals enable row level security;
alter table goal_cheers enable row level security;

create policy "goals: owner full access" on goals
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goals: family can read shared" on goals
  for select using (visibility = 'family' and is_family_member(user_id, auth.uid()));

create policy "goal_cheers: family can read" on goal_cheers
  for select using (
    exists (select 1 from goals g where g.id = goal_id and g.visibility = 'family' and is_family_member(g.user_id, auth.uid()))
  );

create policy "goal_cheers: family can cheer" on goal_cheers
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from goals g where g.id = goal_id and g.visibility = 'family' and is_family_member(g.user_id, auth.uid()))
  );

create policy "goal_cheers: owner can remove own cheer" on goal_cheers
  for delete using (user_id = auth.uid());

-- Events: lightweight family calendar entries (haircut, dinner plans, trips)
-- distinct from diary entries -- forward-looking, not a reflection.
create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  event_date date not null,
  title text not null,
  visibility visibility_level not null default 'private',
  created_at timestamptz not null default now()
);

create index events_user_date_idx on events (user_id, event_date);

alter table events enable row level security;

create policy "events: owner full access" on events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "events: family can read shared" on events
  for select using (visibility = 'family' and is_family_member(user_id, auth.uid()));
