"use client";

// 브라우저에서 사진을 줄여서(긴 변 1600px + 썸네일 480px, JPEG) Storage에 직접 올린다.
// 서버 액션으로 파일을 보내면 본문 크기 제한에 걸리므로 파일은 브라우저 → Storage로 바로 가고,
// 서버 액션은 메타데이터 행만 만든다. 실패하면 올린 파일을 지운다.
import { createClient } from "@/lib/supabase/client";
import { registerPhoto } from "@/app/(app)/trips/actions";
import { JPEG_QUALITY, MAX_FULL_PX, MAX_THUMB_PX, fitWithin, photoPaths } from "./photos";

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // 휴대폰 사진의 회전 정보(EXIF)를 반영해서 읽는다
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      /* 아래 <img> 경로로 시도 */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("이 사진 형식은 지원하지 않아요. JPG나 PNG로 올려주세요.");
  }
}

function toJpeg(img: Awaited<ReturnType<typeof decode>>, max: number): Promise<Blob> {
  const { width, height } = fitWithin(img.width, img.height, max);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("사진을 처리하지 못했어요."));
  ctx.fillStyle = "#fff"; // 투명 PNG가 검게 나오지 않게
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img.source, 0, 0, width, height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("사진을 처리하지 못했어요."))), "image/jpeg", JPEG_QUALITY),
  );
}

export async function uploadTripPhoto(tripId: string, itemId: string | null, file: File): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!file.type.startsWith("image/")) return { ok: false, error: "사진 파일만 올릴 수 있어요." };
  let img: Awaited<ReturnType<typeof decode>>;
  try {
    img = await decode(file);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "사진을 읽지 못했어요." };
  }

  const id = crypto.randomUUID();
  const { path, thumbPath } = photoPaths(tripId, id);
  const storage = createClient().storage.from("trip-media");
  try {
    const [full, thumb] = await Promise.all([toJpeg(img, MAX_FULL_PX), toJpeg(img, MAX_THUMB_PX)]);
    const up1 = await storage.upload(path, full, { contentType: "image/jpeg" });
    if (up1.error) return { ok: false, error: "사진을 올리지 못했어요. 잠시 뒤 다시 시도해주세요." };
    const up2 = await storage.upload(thumbPath, thumb, { contentType: "image/jpeg" });
    if (up2.error) {
      await storage.remove([path]);
      return { ok: false, error: "사진을 올리지 못했어요. 잠시 뒤 다시 시도해주세요." };
    }
    const res = await registerPhoto(tripId, { id, itemId, size: full.size });
    if (!res.ok) {
      await storage.remove([path, thumbPath]);
      return res;
    }
    return { ok: true };
  } catch (e) {
    await storage.remove([path, thumbPath]).catch(() => undefined);
    return { ok: false, error: e instanceof Error ? e.message : "사진을 올리지 못했어요." };
  } finally {
    img.close();
  }
}
