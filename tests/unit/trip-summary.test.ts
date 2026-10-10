import { describe, expect, it } from "vitest";
import { jeonjuTemplate } from "../../src/lib/trip/templates/jeonju";
import { buildTripSummary, fmtWon } from "../../src/lib/trip/summary";
import { TRIP_NOTE_ID, type ProgressRow, type TripPhoto } from "../../src/lib/trip/types";
import type { TripSnapshot } from "../../src/lib/trip/view-model";

const PLAN = "balanced";
const prog = (id: string, over: Partial<ProgressRow> = {}): ProgressRow => ({
  item_id: id, status: null, checks: {}, memo: "", cost: null, review: "", rating: null, updated_at: "", ...over,
});
const photo = (id: string, itemId: string | null): TripPhoto => ({ id, itemId, createdBy: "u1", createdAt: "", url: "u", thumbUrl: "t" });
const snap = (progress: ProgressRow[] = [], photos: TripPhoto[] = []): TripSnapshot => ({
  tripId: "t1", title: "전주 가족 1박 2일", startDate: null, def: structuredClone(jeonjuTemplate), overrides: {},
  progress: Object.fromEntries(progress.map((p) => [p.item_id, p])), photos,
});

describe("fmtWon", () => {
  it("천 단위 쉼표", () => {
    expect(fmtWon(0)).toBe("0원");
    expect(fmtWon(45000)).toBe("45,000원");
    expect(fmtWon(1234567)).toBe("1,234,567원");
  });
});

describe("buildTripSummary", () => {
  it("아무것도 안 했으면 안내 문장과 빈 통계", () => {
    const s = buildTripSummary(snap(), PLAN);
    expect(s.headline).toContain("아직 다녀온 곳이 없어요");
    expect(s.totals).toMatchObject({ done: 0, arrived: 0, skipped: 0, cost: 0, photos: 0, avgRating: null, reviews: 0, walkKm: 0 });
    expect(s.totals.notVisited).toBe(s.totals.planned);
    expect(s.badges).toEqual([]);
    expect(s.highlights).toEqual([]);
  });

  it("방문·건너뜀·지출·별점·소감·사진을 집계한다 (제외된 항목은 계획에서 빠진다)", () => {
    const s = buildTripSummary(
      snap(
        [
          prog("d1-parking", { status: "done", cost: 14400 }),
          prog("d1-lunch", { status: "done", cost: 45000, rating: 5, review: "맛있었어요" }),
          prog("d1-jeondong", { status: "done", rating: 4 }),
          prog("d1-gyeonggijeon", { status: "arrived", rating: 3 }),
          prog("d1-snack", { status: "skipped" }),
        ],
        [photo("p1", "d1-lunch"), photo("p2", "d1-lunch"), photo("p3", null)],
      ),
      PLAN,
    );
    expect(s.totals).toMatchObject({ done: 3, arrived: 1, skipped: 1, cost: 59400, photos: 3, rated: 3, reviews: 1 });
    expect(s.totals.avgRating).toBe(4);
    expect(s.totals.excluded).toBe(1); // 자만벽화마을(기본 제외)
    const d1 = s.days[0];
    expect(d1.stops.find((x) => x.id === "d1-lunch")?.photos).toHaveLength(2);
    expect(s.tripPhotos.map((p) => p.id)).toEqual(["p3"]);
    expect(s.headline).toContain("4곳을 다녀왔어요");
    expect(s.headline).toContain("59,400원");
  });

  it("하이라이트는 별점 높은 순, 같으면 여행 순서 — 항상 같은 결과", () => {
    const rows = [
      prog("d1-lunch", { status: "done", rating: 4 }),
      prog("d1-jeondong", { status: "done", rating: 5 }),
      prog("d1-gyeonggijeon", { status: "done", rating: 4 }),
      prog("d1-snack", { status: "done", rating: 4 }),
      prog("d1-parking", { status: "done", rating: 3 }),
    ];
    const a = buildTripSummary(snap(rows), PLAN);
    const b = buildTripSummary(snap([...rows].reverse()), PLAN);
    expect(a.highlights.map((h) => h.id)).toEqual(["d1-jeondong", "d1-lunch", "d1-gyeonggijeon"]);
    expect(b).toEqual(a);
    expect(a.headline).toContain("가장 좋았던 곳은 전동성당(★★★★★)");
  });

  it("도보 거리는 다녀온 곳으로 가는 구간만 센다", () => {
    const none = buildTripSummary(snap(), PLAN).totals.walkKm;
    const some = buildTripSummary(snap([prog("d1-lunch", { status: "done" }), prog("d1-jeondong", { status: "done" })]), PLAN).totals.walkKm;
    expect(none).toBe(0);
    expect(some).toBeGreaterThan(0);
  });

  it("배지는 고정 임계값으로만: 완주, 사진 10장, 대만족, 소감 5개", () => {
    const d1 = ["d1-parking", "d1-lunch", "d1-jeondong", "d1-gyeonggijeon", "d1-snack", "d1-stay", "d1-hanok-walk", "d1-dinner"];
    const d2 = ["d2-hyanggyo", "d2-omokdae", "d2-market", "d2-fin"];
    const progress = [...d1, ...d2].map((id, i) => prog(id, { status: "done", rating: 5, review: i < 5 ? "좋았다" : "" }));
    const photos = Array.from({ length: 10 }, (_, i) => photo(`p${i}`, "d1-lunch"));
    const s = buildTripSummary(snap(progress, photos), PLAN);
    expect(s.badges).toEqual(expect.arrayContaining(["✅ 계획 완주", "📸 사진 10장", "😊 대만족", "✍️ 소감 5개"]));
    expect(s.badges.some((b) => b.includes("많이 걸은"))).toBe(false); // 총 도보가 5km 미만
  });

  it("여행 전체 소감은 예약 항목(trip-summary)에서 읽고, 계획 통계에는 섞이지 않는다", () => {
    const s = buildTripSummary(snap([prog(TRIP_NOTE_ID, { review: "또 가고 싶다", rating: 5, cost: 100 })]), PLAN);
    expect(s.tripNote).toEqual({ review: "또 가고 싶다", rating: 5 });
    expect(s.totals.rated).toBe(0);
    expect(s.totals.reviews).toBe(0);
  });
});
