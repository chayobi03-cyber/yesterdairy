// 여행 사진의 순수 로직 (브라우저/서버 공용, DB·DOM 비의존).
export const MAX_FULL_PX = 1600;
export const MAX_THUMB_PX = 480;
export const JPEG_QUALITY = 0.82;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 버킷 제한과 동일
export const MAX_PHOTOS_PER_ITEM = 12;
export const MAX_PHOTOS_PER_TRIP = 200;
export const MAX_FILES_PER_PICK = 6;

export const PHOTO_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// 파일 경로는 (trip id, photo id)로만 결정된다. DB 제약(trip_photos_path_fixed)과 같은 형식.
export function photoPaths(tripId: string, photoId: string): { path: string; thumbPath: string } {
  return { path: `${tripId}/${photoId}.jpg`, thumbPath: `${tripId}/${photoId}_t.jpg` };
}

// 긴 변이 max를 넘으면 비율을 유지해 줄이고, 아니면 그대로 둔다 (확대하지 않는다).
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const longest = Math.max(width, height);
  if (longest <= max) return { width: Math.round(width), height: Math.round(height) };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function canAddPhotos(existingForItem: number, existingForTrip: number, adding: number): { ok: true } | { ok: false; error: string } {
  if (existingForItem + adding > MAX_PHOTOS_PER_ITEM) return { ok: false, error: `한 곳에는 사진을 ${MAX_PHOTOS_PER_ITEM}장까지 올릴 수 있어요.` };
  if (existingForTrip + adding > MAX_PHOTOS_PER_TRIP) return { ok: false, error: `한 여행에는 사진을 ${MAX_PHOTOS_PER_TRIP}장까지 올릴 수 있어요.` };
  return { ok: true };
}
