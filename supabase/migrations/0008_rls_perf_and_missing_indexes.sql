-- Supabase's own performance advisor flagged two real issues across every
-- policy in the schema:
--
-- 1. auth.uid() called directly in a policy gets re-evaluated by Postgres
--    for every row scanned, instead of once per query. Wrapping it as
--    (select auth.uid()) makes it a stable subquery the planner can
--    evaluate a single time. This is Supabase's documented #1 RLS perf
--    footgun and every single policy here had it.
-- 2. Five foreign key columns had no covering index, forcing a sequential
--    scan on the referenced side for every FK check / join.
--
-- No policy's actual authorization logic changes here, only how the
-- planner evaluates it -- confirmed by re-running the advisor after.

alter policy "member can read own family" on families
  using (exists (select 1 from family_members fm where fm.family_id = id and fm.user_id = (select auth.uid())));

alter policy "family create" on families
  with check ((select auth.uid()) is not null);

alter policy "profiles readable by family members" on profiles
  using (is_family_member(id, (select auth.uid())) or id = (select auth.uid()));

alter policy "profile self update" on profiles
  using (id = (select auth.uid()));

alter policy "profiles insert self" on profiles
  with check (id = (select auth.uid()));

alter policy "family members readable within family" on family_members
  using (is_family_member(user_id, (select auth.uid())));

alter policy "family_members insert self" on family_members
  with check (user_id = (select auth.uid()));

alter policy "entries: owner full access" on diary_entries
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy "entries: family can read shared" on diary_entries
  using (visibility = 'family' and is_family_member(user_id, (select auth.uid())));

alter policy "media: owner full access" on media
  using (exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = (select auth.uid())));

alter policy "media: family can read shared" on media
  using (
    visibility = 'family'
    and exists (select 1 from diary_entries e where e.id = entry_id and is_family_member(e.user_id, (select auth.uid())))
  );

alter policy "reactions: family can read" on reactions
  using (
    exists (select 1 from diary_entries e where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, (select auth.uid())))
  );

alter policy "reactions: family can react" on reactions
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from diary_entries e where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, (select auth.uid())))
  );

alter policy "reactions: owner can delete own reaction" on reactions
  using (user_id = (select auth.uid()));

alter policy "comments: family can read" on comments
  using (
    exists (select 1 from diary_entries e where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, (select auth.uid())))
  );

alter policy "comments: family can write" on comments
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from diary_entries e where e.id = entry_id and e.visibility = 'family' and is_family_member(e.user_id, (select auth.uid())))
  );

alter policy "comments: author can update/delete own" on comments
  using (user_id = (select auth.uid()));

alter policy "comments: author can delete own" on comments
  using (user_id = (select auth.uid()));

alter policy "goals: owner full access" on goals
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy "goals: family can read shared" on goals
  using (visibility = 'family' and is_family_member(user_id, (select auth.uid())));

alter policy "goal_cheers: family can read" on goal_cheers
  using (
    exists (select 1 from goals g where g.id = goal_id and g.visibility = 'family' and is_family_member(g.user_id, (select auth.uid())))
  );

alter policy "goal_cheers: family can cheer" on goal_cheers
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from goals g where g.id = goal_id and g.visibility = 'family' and is_family_member(g.user_id, (select auth.uid())))
  );

alter policy "goal_cheers: owner can remove own cheer" on goal_cheers
  using (user_id = (select auth.uid()));

alter policy "events: owner full access" on events
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy "events: family can read shared" on events
  using (visibility = 'family' and is_family_member(user_id, (select auth.uid())));

-- missing FK indexes
create index if not exists comments_entry_id_idx on comments (entry_id);
create index if not exists comments_user_id_idx on comments (user_id);
create index if not exists family_members_user_id_idx on family_members (user_id);
create index if not exists goal_cheers_user_id_idx on goal_cheers (user_id);
create index if not exists reactions_user_id_idx on reactions (user_id);
