import { createClient } from "@/lib/supabase/server";

export type AlbumPhoto = {
  id: string;
  url: string;
  entryDate?: string;
  category?: string;
  authorName: string;
};

export async function getAlbumPhotos(): Promise<AlbumPhoto[]> {
  const supabase = await createClient();

  // No visibility/user_id filter -- RLS already scopes this to the caller's
  // own photos (any visibility) plus family members' photos on family-visible
  // entries, same pattern used on the calendar and family feed.
  const { data: media } = await supabase
    .from("media")
    .select("id, original_path, created_at, entry_id, diary_entries(entry_date, category, user_id, profiles(name))")
    .order("created_at", { ascending: false })
    .limit(60);

  const paths = (media ?? []).map((m) => m.original_path);
  const { data: signedUrls } = paths.length
    ? await supabase.storage.from("diary-media").createSignedUrls(paths, 60 * 60)
    : { data: [] as { path: string | null; signedUrl: string }[] | null };

  const urlByPath = new Map((signedUrls ?? []).map((s) => [s.path, s.signedUrl]));

  return (media ?? [])
    .map((m) => {
      const entry = m.diary_entries as unknown as {
        entry_date: string;
        category: string;
        user_id: string;
        profiles: { name: string } | null;
      } | null;
      const photo: Omit<AlbumPhoto, "url"> & { url: string | null | undefined } = {
        id: m.id,
        url: urlByPath.get(m.original_path),
        entryDate: entry?.entry_date,
        category: entry?.category,
        authorName: entry?.profiles?.name ?? "가족",
      };
      return photo;
    })
    .filter((p): p is AlbumPhoto => !!p.url);
}
