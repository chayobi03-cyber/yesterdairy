import { describe, expect, it } from "vitest";
import { MAX_PHOTOS_PER_ITEM, MAX_PHOTOS_PER_TRIP, PHOTO_ID_RE, canAddPhotos, fitWithin, photoPaths } from "../../src/lib/trip/photos";

describe("fitWithin", () => {
  it("긴 변이 한계 이하면 그대로 (확대하지 않음)", () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });
  it("가로/세로 어느 쪽이 길어도 비율을 유지해 줄인다", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4032, 3024, 480)).toEqual({ width: 480, height: 360 });
  });
  it("아주 얇은 사진도 최소 1px, 잘못된 크기는 0", () => {
    expect(fitWithin(10000, 1, 1600)).toEqual({ width: 1600, height: 1 });
    expect(fitWithin(0, 100, 1600)).toEqual({ width: 0, height: 0 });
    expect(fitWithin(Number.NaN, 100, 1600)).toEqual({ width: 0, height: 0 });
  });
});

describe("photoPaths", () => {
  it("(여행 id, 사진 id)로만 결정되는 고정 형식 — DB 제약과 같은 모양", () => {
    const t = "11111111-1111-4111-8111-111111111111";
    const p = "22222222-2222-4222-8222-222222222222";
    expect(photoPaths(t, p)).toEqual({ path: `${t}/${p}.jpg`, thumbPath: `${t}/${p}_t.jpg` });
    expect(PHOTO_ID_RE.test(p)).toBe(true);
    expect(PHOTO_ID_RE.test("../etc/passwd")).toBe(false);
    expect(PHOTO_ID_RE.test("ABCDEF01-2222-4222-8222-222222222222")).toBe(false); // 소문자 hex만
  });
});

describe("canAddPhotos", () => {
  it("장소별 12장, 여행 전체 200장 한도", () => {
    expect(canAddPhotos(0, 0, 3).ok).toBe(true);
    expect(canAddPhotos(MAX_PHOTOS_PER_ITEM, 12, 1).ok).toBe(false);
    expect(canAddPhotos(MAX_PHOTOS_PER_ITEM - 1, 12, 1).ok).toBe(true);
    expect(canAddPhotos(0, MAX_PHOTOS_PER_TRIP, 1).ok).toBe(false);
    const r = canAddPhotos(11, 20, 2);
    expect(!r.ok && r.error).toContain("12장");
  });
});
