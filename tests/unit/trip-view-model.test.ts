import { describe, expect, it } from "vitest";
import { jeonjuTemplate } from "../../src/lib/trip/templates/jeonju";
import {
  applyDayStart, applyNewPlace, applyOp, applyProgress, buildRows, candidatePins, currentStopId, dayKey, dayLabel, daySummary, dayStats,
  excludedMandatory, getDayItems, nextStopId, routeStops, snapshotSignature, totalCost, type TripSnapshot,
} from "../../src/lib/trip/view-model";
import type { NewPlaceInput } from "../../src/lib/trip/day-ops";

const base = (over: Partial<TripSnapshot> = {}): TripSnapshot => ({
  tripId: "t1",
  title: "전주",
  startDate: null,
  def: structuredClone(jeonjuTemplate),
  overrides: {},
  progress: {},
  photos: [],
  comments: [],
  ...over,
});
const PLAN = "balanced";

describe("getDayItems", () => {
  it("편집본이 없으면 기본 일정, 있으면 편집본", () => {
    const s = base();
    expect(getDayItems(s, PLAN, 1)[0].id).toBe("d1-parking");
    const edited = base({ overrides: { [dayKey(PLAN, 1)]: [{ id: "x", rest: "휴식" }] } });
    expect(getDayItems(edited, PLAN, 1)).toEqual([{ id: "x", rest: "휴식" }]);
  });
  it("없는 대안/날짜는 빈 배열", () => {
    expect(getDayItems(base(), "nope", 1)).toEqual([]);
    expect(getDayItems(base(), PLAN, 9)).toEqual([]);
  });
});

describe("applyOp", () => {
  it("원본 스냅샷을 바꾸지 않고 새 스냅샷을 돌려준다", () => {
    const s = base();
    const before = JSON.stringify(s);
    const r = applyOp(s, PLAN, 1, { type: "toggle", itemId: "d1-snack" });
    expect(JSON.stringify(s)).toBe(before);
    expect(r.ok && getDayItems(r.snapshot, PLAN, 1).find((i) => i.id === "d1-snack")?.included).toBe(false);
  });
  it("다른 날짜/대안의 편집본은 건드리지 않는다", () => {
    const r = applyOp(base(), PLAN, 1, { type: "toggle", itemId: "d1-snack" });
    expect(r.ok && Object.keys(r.snapshot.overrides)).toEqual([dayKey(PLAN, 1)]);
  });
  it("규칙 위반은 오류로 돌려준다 (필수끼리 교환, 필수 삭제)", () => {
    const items = getDayItems(base(), PLAN, 1);
    const i = items.findIndex((x) => x.p === "jeondong");
    expect(applyOp(base(), PLAN, 1, { type: "move", index: i, dir: 1 }).ok).toBe(false);
    expect(applyOp(base(), PLAN, 1, { type: "remove", itemId: "d1-jeondong" }).ok).toBe(false);
  });
  it("reset은 그 날짜의 편집본만 지운다", () => {
    const a = applyOp(base(), PLAN, 1, { type: "toggle", itemId: "d1-snack" });
    const b = a.ok && applyOp(a.snapshot, PLAN, 2, { type: "toggle", itemId: "d2-mural" });
    const c = b && b.ok && applyOp(b.snapshot, PLAN, 1, { type: "reset" });
    expect(c && c.ok && Object.keys(c.snapshot.overrides)).toEqual([dayKey(PLAN, 2)]);
  });
  it("항목 id를 정해서 추가하면 그 id를 쓴다 (서버와 화면이 같은 id를 갖게)", () => {
    const r = applyOp(base(), PLAN, 1, { type: "add", placeId: "cafe", id: "it-fixed" });
    expect(r.ok && getDayItems(r.snapshot, PLAN, 1).at(-1)).toEqual({ id: "it-fixed", p: "cafe" });
  });
});

describe("applyProgress", () => {
  it("행이 없으면 만들고, 있으면 병합하며 updated_at은 유지", () => {
    const a = applyProgress(base(), "d1-lunch", { status: "arrived" });
    expect(a.ok && a.snapshot.progress["d1-lunch"]).toMatchObject({ status: "arrived", memo: "", cost: null });
    const withRow = base({ progress: { "d1-lunch": { item_id: "d1-lunch", status: "arrived", checks: {}, memo: "m", cost: 100, review: "", rating: null, updated_at: "2026-10-09T00:00:00.000Z" } } });
    const b = applyProgress(withRow, "d1-lunch", { cost: 5000 });
    expect(b.ok && b.snapshot.progress["d1-lunch"]).toMatchObject({ status: "arrived", memo: "m", cost: 5000, review: "", rating: null, updated_at: "2026-10-09T00:00:00.000Z" });
  });
  it("잘못된 값은 거부하고 원본은 그대로", () => {
    const s = base();
    expect(applyProgress(s, "d1-lunch", { cost: -1 }).ok).toBe(false);
    expect(s.progress).toEqual({});
  });
});

describe("applyNewPlace", () => {
  const input: NewPlaceInput = { name: "카페", cat: "food", addr: "", lat: "35.81", lon: "127.15", dur: "45", hours: "", desc: "", note: "" };
  it("장소를 추가하고 같은 id가 이미 있으면 거부", () => {
    const r = applyNewPlace(base(), input, "u-1");
    expect(r.ok && r.snapshot.def.places.some((p) => p.id === "u-1")).toBe(true);
    expect(applyNewPlace(base(), input, "cafe").ok).toBe(false);
  });
  it("검증 실패(좌표 범위)는 오류", () => {
    expect(applyNewPlace(base(), { ...input, lat: "95" }, "u-2").ok).toBe(false);
  });
});

describe("buildRows / 번호 / 진행", () => {
  it("포함된 항목만 1부터 번호를 매기고 제외 항목은 번호가 없다", () => {
    const a = applyOp(base(), PLAN, 1, { type: "toggle", itemId: "d1-lunch" });
    const rows = a.ok ? buildRows(a.snapshot, PLAN, 1) : [];
    expect(rows.find((r) => r.id === "d1-lunch")?.number).toBeNull();
    const nums = rows.filter((r) => r.included).map((r) => r.number);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });
  it("진행 상태가 행에 붙는다", () => {
    const s = base({ progress: { "d1-parking": { item_id: "d1-parking", status: "done", checks: {}, memo: "", cost: null, review: "", rating: null, updated_at: "" } } });
    expect(buildRows(s, PLAN, 1)[0].status).toBe("done");
  });
  it("날짜별 시작 시각을 쓴다", () => {
    expect(buildRows(base(), PLAN, 1)[0].start).toBe(11 * 60 + 30);
    expect(buildRows(base(), PLAN, 2)[0].start).toBe(9 * 60 + 30);
  });
});

describe("currentStopId / nextStopId", () => {
  const done = (id: string) => ({ item_id: id, status: "done" as const, checks: {}, memo: "", cost: null, review: "", rating: null, updated_at: "" });
  it("첫 미완료 포함 항목이 지금 장소", () => {
    expect(currentStopId(base(), PLAN, 1)).toBe("d1-parking");
    const s = base({ progress: { "d1-parking": done("d1-parking") } });
    expect(currentStopId(s, PLAN, 1)).toBe("d1-lunch");
  });
  it("모두 끝나면 null", () => {
    const all = Object.fromEntries(getDayItems(base(), PLAN, 2).map((i) => [i.id, done(i.id)]));
    expect(currentStopId(base({ progress: all }), PLAN, 2)).toBeNull();
  });
  it("다음 장소는 완료/건너뜀/제외를 건너뛴다", () => {
    const s = base({ progress: { "d2-hyanggyo": done("d2-hyanggyo") } });
    const rows = buildRows(s, PLAN, 2);
    expect(nextStopId(rows, "d2-hyanggyo")).toBe("d2-omokdae");
    // 오목대 다음은 제외된 벽화마을을 건너뛰고 시장
    expect(nextStopId(rows, "d2-omokdae")).toBe("d2-market");
    expect(nextStopId(rows, "d2-fin")).toBeNull();
  });
});

describe("dayStats / totalCost", () => {
  it("완료/건너뜀 비율", () => {
    const mk = (id: string, status: "done" | "skipped") => ({ item_id: id, status, checks: {}, memo: "", cost: 1000, review: "", rating: null, updated_at: "" });
    const s = base({ progress: { "d2-hyanggyo": mk("d2-hyanggyo", "done"), "d2-omokdae": mk("d2-omokdae", "skipped") } });
    const st = dayStats(buildRows(s, PLAN, 2));
    expect(st).toEqual({ total: 4, done: 1, skipped: 1, percent: 50 });
    expect(totalCost(s)).toBe(2000);
  });
  it("빈 날짜는 0%", () => {
    expect(dayStats(buildRows(base(), PLAN, 3))).toEqual({ total: 0, done: 0, skipped: 0, percent: 0 });
  });
});

describe("지도용 데이터", () => {
  it("동선은 포함된 항목 중 좌표가 있는 곳만, 목록과 같은 번호", () => {
    const rows = buildRows(base(), PLAN, 1);
    const pins = routeStops(rows);
    const stayNumber = rows.find((r) => r.id === "d1-stay")?.number; // 숙소는 좌표가 없다
    expect(pins.some((p) => p.number === stayNumber)).toBe(false);
    for (const p of pins) expect(rows.find((r) => r.id === p.id)?.number).toBe(p.number);
  });
  it("제외된 항목은 지도에서 빠진다", () => {
    const a = applyOp(base(), PLAN, 1, { type: "toggle", itemId: "d1-lunch" });
    const pins = a.ok ? routeStops(buildRows(a.snapshot, PLAN, 1)) : [];
    expect(pins.some((p) => p.id === "d1-lunch")).toBe(false);
  });
  it("전체 장소 후보는 오늘 일정에 없는 좌표 있는 장소", () => {
    const s = base();
    const cand = candidatePins(s, buildRows(s, PLAN, 1));
    const names = cand.map((c) => c.placeId);
    expect(names).toContain("hyanggyo"); // 2일차 장소는 1일차 후보
    expect(names).not.toContain("jeondong"); // 오늘 일정에 있음
    expect(names).not.toContain("stay"); // 좌표 없음
  });
});

describe("기타", () => {
  it("제외된 필수 방문지를 알려준다", () => {
    const a = applyOp(base(), PLAN, 1, { type: "toggle", itemId: "d1-jeondong" });
    expect(a.ok && excludedMandatory(a.snapshot, PLAN)).toEqual(["전동성당"]);
    expect(excludedMandatory(base(), PLAN)).toEqual([]);
  });
  it("출발일이 있으면 날짜 라벨에 월/일을 붙인다", () => {
    expect(dayLabel(base(), 1)).toBe("1일차");
    expect(dayLabel(base({ startDate: "2026-10-17" }), 2)).toBe("2일차 (10/18)");
  });
  it("지문은 내용이 같으면 같고 다르면 다르다", () => {
    expect(snapshotSignature(base())).toBe(snapshotSignature(base()));
    const a = applyOp(base(), PLAN, 1, { type: "toggle", itemId: "d1-snack" });
    expect(a.ok && snapshotSignature(a.snapshot)).not.toBe(snapshotSignature(base()));
  });
});

describe("고정 시각과 하루 요약", () => {
  it("균형형 1일차: 저녁은 17:30 고정이라 일찍 도착하면 기다리고, 끝나는 시각이 계산된다", () => {
    const rows = buildRows(base(), PLAN, 1);
    const dinner = rows.find((r) => r.id === "d1-dinner")!;
    expect(dinner.start).toBe(17 * 60 + 30);
    expect(dinner.wait).toBeGreaterThan(0);
    expect(dinner.late).toBe(0);
    const sum = daySummary(rows);
    expect(sum.startMin).toBe(11 * 60 + 30);
    expect(sum.endMin).toBe(dinner.end);
    expect(sum.waitMin).toBe(dinner.wait);
    expect(sum.walkKm).toBeGreaterThan(0);
    expect(sum.lateCount).toBe(0);
  });

  it("setAt으로 앞 항목이 길어져 고정 시각을 넘기면 '늦음'으로 표시된다", () => {
    let s = base();
    // 경기전 체류를 +300분 늘리면 저녁(17:30)을 넘긴다
    for (let i = 0; i < 6; i++) {
      const r = applyOp(s, PLAN, 1, { type: "dur", itemId: "d1-gyeonggijeon", delta: 50 });
      if (!r.ok) throw new Error(r.error);
      s = r.snapshot;
    }
    const rows = buildRows(s, PLAN, 1);
    const dinner = rows.find((r) => r.id === "d1-dinner")!;
    expect(dinner.late).toBeGreaterThan(0);
    expect(dinner.wait).toBe(0);
    expect(daySummary(rows).lateCount).toBe(1);
  });

  it("applyOp setAt: 지정과 해제", () => {
    const set = applyOp(base(), PLAN, 1, { type: "setAt", itemId: "d1-snack", at: "15:00" });
    if (!set.ok) throw new Error(set.error);
    expect(getDayItems(set.snapshot, PLAN, 1).find((i) => i.id === "d1-snack")?.at).toBe("15:00");
    const cleared = applyOp(set.snapshot, PLAN, 1, { type: "setAt", itemId: "d1-snack", at: null });
    if (!cleared.ok) throw new Error(cleared.error);
    expect(getDayItems(cleared.snapshot, PLAN, 1).find((i) => i.id === "d1-snack")?.at).toBeUndefined();
  });
});

describe("applyDayStart", () => {
  it("해당 날짜의 시작 시각만 바꾸고 시간표가 따라 움직인다", () => {
    const s = base();
    const r = applyDayStart(s, 1, "09:00");
    if (!r.ok) throw new Error(r.error);
    expect(r.snapshot.def.days.find((d) => d.n === 1)?.start).toBe("09:00");
    expect(r.snapshot.def.days.find((d) => d.n === 2)?.start).toBe("09:30");
    expect(s.def.days[0].start).toBe("11:30"); // 원본은 그대로
    expect(buildRows(r.snapshot, PLAN, 1)[0].start).toBe(9 * 60);
  });
  it("형식이 틀리거나 없는 날짜는 거부", () => {
    expect(applyDayStart(base(), 1, "9시").ok).toBe(false);
    expect(applyDayStart(base(), 1, "24:00").ok).toBe(false);
    expect(applyDayStart(base(), 9, "09:00").ok).toBe(false);
  });
});
