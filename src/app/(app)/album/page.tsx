import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getAlbumPhotos } from "./get-photos";
import { AlbumPhotoGrid } from "./photo-grid";

export default async function AlbumPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const photos = await getAlbumPhotos();

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">📸 앨범</h1>
          <p className="mt-1 text-xs text-neutral-400">나와 가족이 기록에 남긴 사진들이에요.</p>
        </div>
        {photos.length >= 4 && (
          <Link
            href="/album/collage"
            className="shrink-0 rounded-full bg-accent-400 px-3 py-1.5 text-xs font-medium text-white"
          >
            🧩 콜라주 만들기
          </Link>
        )}
      </div>

      {!photos.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-neutral-400">
          아직 모인 사진이 없어요. 기록할 때 사진을 추가해보세요.
        </p>
      ) : (
        <AlbumPhotoGrid photos={photos} />
      )}
    </div>
  );
}
