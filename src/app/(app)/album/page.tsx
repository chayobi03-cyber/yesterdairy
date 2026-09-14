import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { categoryMeta } from "@/lib/categories";

export default async function AlbumPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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

  const photos = (media ?? [])
    .map((m) => {
      const entry = m.diary_entries as unknown as {
        entry_date: string;
        category: string;
        user_id: string;
        profiles: { name: string } | null;
      } | null;
      return {
        id: m.id,
        url: urlByPath.get(m.original_path),
        entryDate: entry?.entry_date,
        category: entry?.category,
        authorName: entry?.profiles?.name ?? "가족",
      };
    })
    .filter((p): p is typeof p & { url: string } => !!p.url);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-lg font-semibold">📸 앨범</h1>
        <p className="mt-1 text-xs text-neutral-400">나와 가족이 기록에 남긴 사진들이에요.</p>
      </div>

      {!photos.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-400">
          아직 모인 사진이 없어요. 기록할 때 사진을 추가해보세요.
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-1.5">
          {photos.map((photo) => (
            <li key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs expire; a plain <img> avoids next/image's remote-domain + caching assumptions */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
              {photo.category && (
                <span className="absolute bottom-1 left-1 text-xs drop-shadow">{categoryMeta(photo.category).emoji}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
