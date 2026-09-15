-- Supabase's performance advisor flags diary_entries/events/goals/media:
-- each has an "owner full access" (FOR ALL) policy plus a separate
-- "family can read shared" (FOR SELECT) policy, so every SELECT has to
-- evaluate and OR together two permissive policies instead of one. Behavior
-- is unchanged -- owners keep full read/write on their own rows, family
-- members keep read-only access to shared rows -- this only collapses the
-- SELECT path into a single policy per table and splits the write path
-- into its own insert/update/delete policies (Postgres doesn't allow a
-- single CREATE POLICY to target insert+update+delete without also
-- covering select the way ALL does).

drop policy "entries: owner full access" on diary_entries;
drop policy "entries: family can read shared" on diary_entries;

create policy "entries: read own or shared" on diary_entries
  for select using (
    user_id = (select auth.uid())
    or (visibility = 'family' and is_family_member(user_id, (select auth.uid())))
  );

create policy "entries: owner can insert" on diary_entries
  for insert with check (user_id = (select auth.uid()));

create policy "entries: owner can update" on diary_entries
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "entries: owner can delete" on diary_entries
  for delete using (user_id = (select auth.uid()));

drop policy "events: owner full access" on events;
drop policy "events: family can read shared" on events;

create policy "events: read own or shared" on events
  for select using (
    user_id = (select auth.uid())
    or (visibility = 'family' and is_family_member(user_id, (select auth.uid())))
  );

create policy "events: owner can insert" on events
  for insert with check (user_id = (select auth.uid()));

create policy "events: owner can update" on events
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "events: owner can delete" on events
  for delete using (user_id = (select auth.uid()));

drop policy "goals: owner full access" on goals;
drop policy "goals: family can read shared" on goals;

create policy "goals: read own or shared" on goals
  for select using (
    user_id = (select auth.uid())
    or (visibility = 'family' and is_family_member(user_id, (select auth.uid())))
  );

create policy "goals: owner can insert" on goals
  for insert with check (user_id = (select auth.uid()));

create policy "goals: owner can update" on goals
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "goals: owner can delete" on goals
  for delete using (user_id = (select auth.uid()));

drop policy "media: owner full access" on media;
drop policy "media: family can read shared" on media;

create policy "media: read own or shared" on media
  for select using (
    exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
    or (
      visibility = 'family'
      and exists (
        select 1 from diary_entries e
        where e.id = entry_id and is_family_member(e.user_id, (select auth.uid()))
      )
    )
  );

create policy "media: owner can insert" on media
  for insert with check (
    exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
  );

create policy "media: owner can update" on media
  for update
  using (exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = (select auth.uid())));

create policy "media: owner can delete" on media
  for delete using (
    exists (select 1 from diary_entries e where e.id = entry_id and e.user_id = (select auth.uid()))
  );
