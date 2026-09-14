-- Storage RLS only ever let the owner's own folder be read (or written), so
-- even though the `media` table already lets family members read rows for
-- family-visible entries, they had no way to actually fetch the file bytes
-- for an album view. Mirror the same "family can read shared" rule used on
-- the `media` table, scoped to storage.objects for the diary-media bucket.

create policy "diary-media: family can read shared"
  on storage.objects for select
  using (
    bucket_id = 'diary-media'
    and exists (
      select 1 from media m
      join diary_entries e on e.id = m.entry_id
      where m.original_path = storage.objects.name
        and m.visibility = 'family'
        and is_family_member(e.user_id, (select auth.uid()))
    )
  );
