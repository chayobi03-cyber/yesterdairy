import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getAlbumPhotos } from "../get-photos";
import { CollageMaker } from "./collage-maker";

export default async function CollagePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const photos = await getAlbumPhotos();
  if (photos.length < 4) redirect("/album");

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-lg font-semibold">🧩 콜라주 만들기</h1>
        <p className="mt-1 text-xs text-neutral-400">사진을 골라서 한 장으로 모아보세요.</p>
      </div>
      <CollageMaker photos={photos.map((p) => ({ id: p.id, url: p.url }))} />
    </div>
  );
}
