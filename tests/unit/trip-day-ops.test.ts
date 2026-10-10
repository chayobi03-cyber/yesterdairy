import { describe, expect, it } from "vitest";
import { applyDayOp, buildPlace, setPlaceCoord, MAX_ITEMS_PER_DAY, type NewPlaceInput } from "../../src/lib/trip/day-ops";
import { applyProgressPatch, EMPTY_PROGRESS } from "../../src/lib/trip/progress";
import { MAX_CAS_ATTEMPTS, nextVersion } from "../../src/lib/trip/cas";
import type { Place, PlanItem } from "../../src/lib/trip/types";

const places: Place[] = [
  { id: "m1", name: "필수1", dur: 40 },
  { id: "m2", name: "필수2", dur: 40 },
  { id: "x", name: "일반", dur: 25 },
];
const ctx = { places, mandatory: ["m1", "m2"] };
const base = (): PlanItem[] => [{ id: "1", p: "m1" }, { id: "2", p: "m2" }, { id: "3", p: "x" }];

function ok(r: ReturnType<typeof applyDayOp>): PlanItem[] {
  if (!r.ok) throw new Error(r.error);
  return r.items;
}

describe("applyDayOp", () => {
  it("입력 배열을 바꾸지 않는다 (재시도 시 같은 입력을 다시 쓸 수 있어야 함)", () => {
    const input = base();
    const snapshot = structuredClone(input);
    applyDayOp(input, { type: "toggle", itemId: "3" }, ctx);
    applyDayOp(input, { type: "dur", itemId: "3", delta: 10 }, ctx);
    applyDayOp(input, { type: "remove", itemId: "3" }, ctx);
    expect(input).toEqual(snapshot);
  });

  it("toggle: 제외 <-> 포함", () => {
    const once = ok(applyDayOp(base(), { type: "toggle", itemId: "3" }, ctx));
    expect(once[2].included).toBe(false);
    const twice = ok(applyDayOp(once, { type: "toggle", itemId: "3" }, ctx));
    expect(twice[2].included).toBe(true);
  });

  it("toggle: 없는 항목은 오류", () => {
    expect(applyDayOp(base(), { type: "toggle", itemId: "zzz" }, ctx).ok).toBe(false);
  });

  it("dur: 장소 기본 체류시간 기준으로 증감하고 5~600분으로 제한", () => {
    const up = ok(applyDayOp(base(), { type: "dur", itemId: "3", delta: 10 }, ctx));
    expect(up[2].dur).toBe(35);
    let items = base();
    for (let i = 0; i < 10; i++) items = ok(applyDayOp(items, { type: "dur", itemId: "3", delta: -10 }, ctx));
    expect(items[2].dur).toBe(5);
    expect(ok(applyDayOp(base(), { type: "dur", itemId: "3", delta: 100000 }, ctx))[2].dur).toBe(600);
  });

  it("dur: 장소 없는 항목은 30분 기준", () => {
    const items = ok(applyDayOp([{ id: "r", rest: "휴식" }], { type: "dur", itemId: "r", delta: 10 }, ctx));
    expect(items[0].dur).toBe(40);
  });

  it("move: 필수끼리는 거부, 그 외는 이동", () => {
    expect(applyDayOp(base(), { type: "move", index: 0, dir: 1 }, ctx)).toEqual({ ok: false, error: "필수 방문지끼리의 순서는 임의로 바꾸지 않아요." });
    const moved = ok(applyDayOp(base(), { type: "move", index: 2, dir: -1 }, ctx));
    expect(moved.map((i) => i.id)).toEqual(["1", "3", "2"]);
  });

  it("add: 알 수 없는 장소는 거부, 아니면 새 id로 끝에 추가", () => {
    expect(applyDayOp(base(), { type: "add", placeId: "nope" }, ctx).ok).toBe(false);
    const items = ok(applyDayOp(base(), { type: "add", placeId: "x" }, ctx));
    expect(items).toHaveLength(4);
    expect(items[3].p).toBe("x");
    expect(new Set(items.map((i) => i.id)).size).toBe(4);
  });

  it("add/addRest: 하루 항목 수 상한", () => {
    const full: PlanItem[] = Array.from({ length: MAX_ITEMS_PER_DAY }, (_, i) => ({ id: `i${i}`, p: "x" }));
    expect(applyDayOp(full, { type: "add", placeId: "x" }, ctx).ok).toBe(false);
    expect(applyDayOp(full, { type: "addRest", title: "휴식" }, ctx).ok).toBe(false);
  });

  it("addRest: 공백 이름 거부, 60자로 자르기", () => {
    expect(applyDayOp(base(), { type: "addRest", title: "   " }, ctx).ok).toBe(false);
    const items = ok(applyDayOp(base(), { type: "addRest", title: "가".repeat(100) }, ctx));
    expect(items[3].rest).toHaveLength(60);
    expect(items[3].dur).toBe(30);
  });

  it("remove: 필수 방문지는 삭제 불가(제외만 가능), 일반은 삭제", () => {
    const r = applyDayOp(base(), { type: "remove", itemId: "1" }, ctx);
    expect(r).toEqual({ ok: false, error: "필수 방문지는 삭제할 수 없어요. 제외로 바꿔주세요." });
    expect(ok(applyDayOp(base(), { type: "remove", itemId: "3" }, ctx)).map((i) => i.id)).toEqual(["1", "2"]);
  });

  it("moveTo: 여러 칸을 한 번에 옮기고, 필수 방문지는 추월하지 못한다", () => {
    const items: PlanItem[] = [{ id: "a", p: "x" }, { id: "1", p: "m1" }, { id: "2", p: "m2" }, { id: "b", p: "x" }];
    expect(ok(applyDayOp(items, { type: "moveTo", from: 0, to: 3 }, ctx)).map((i) => i.id)).toEqual(["1", "2", "b", "a"]); // 일반 항목은 필수를 지나갈 수 있음
    expect(applyDayOp(items, { type: "moveTo", from: 1, to: 3 }, ctx).ok).toBe(false); // 필수1이 필수2를 추월
    expect(ok(applyDayOp(items, { type: "moveTo", from: 3, to: 0 }, ctx)).map((i) => i.id)).toEqual(["b", "a", "1", "2"]);
    expect(applyDayOp(items, { type: "moveTo", from: 0, to: 9 }, ctx).ok).toBe(false);
    expect(applyDayOp(items, { type: "moveTo", from: -1, to: 2 }, ctx).ok).toBe(false);
    expect(ok(applyDayOp(items, { type: "moveTo", from: 2, to: 2 }, ctx)).map((i) => i.id)).toEqual(["a", "1", "2", "b"]);
  });

  it("add/addRest: 호출자가 정한 id를 쓰되 형식과 중복을 검사", () => {
    expect(ok(applyDayOp(base(), { type: "add", placeId: "x", id: "it-mine" }, ctx))[3].id).toBe("it-mine");
    expect(ok(applyDayOp(base(), { type: "addRest", title: "쉼", id: "it-rest" }, ctx))[3].id).toBe("it-rest");
    expect(applyDayOp(base(), { type: "add", placeId: "x", id: "bad id!" }, ctx).ok).toBe(false);
    expect(applyDayOp(base(), { type: "add", placeId: "x", id: "1" }, ctx).ok).toBe(false); // 이미 있는 id
    expect(applyDayOp(base(), { type: "add", placeId: "x", id: "" }, ctx).ok).toBe(false);
  });

  it("동시 편집 재현: 같은 기준에서 서로 다른 변경을 순서대로 다시 적용하면 둘 다 남는다", () => {
    // 낙관적 잠금 재시도 = '최신 데이터에 같은 연산을 다시 적용'
    const afterA = ok(applyDayOp(base(), { type: "toggle", itemId: "3" }, ctx)); // A가 먼저 저장
    const afterB = ok(applyDayOp(afterA, { type: "dur", itemId: "1", delta: 10 }, ctx)); // B는 최신본에 재적용
    expect(afterB[2].included).toBe(false);
    expect(afterB[0].dur).toBe(50);
  });
});

describe("buildPlace", () => {
  const input = (over: Partial<NewPlaceInput> = {}): NewPlaceInput => ({
    name: "카페", cat: "food", addr: "", lat: "", lon: "", dur: "45", hours: "", desc: "", note: "", ...over,
  });

  it("최소 입력으로 생성", () => {
    const r = buildPlace(input(), "u-1");
    expect(r).toMatchObject({ ok: true, place: { id: "u-1", name: "카페", cat: "food", dur: 45 } });
    if (r.ok) {
      expect(r.place.lat).toBeUndefined();
      expect(r.place.addr).toBeUndefined();
    }
  });
  it("이름 필수, 좌표는 짝으로, 범위 검증, 체류시간 범위", () => {
    expect(buildPlace(input({ name: "  " })).ok).toBe(false);
    expect(buildPlace(input({ lat: "35.8" })).ok).toBe(false);
    expect(buildPlace(input({ lon: "127.1" })).ok).toBe(false);
    expect(buildPlace(input({ lat: "95", lon: "127" })).ok).toBe(false);
    expect(buildPlace(input({ lat: "abc", lon: "127" })).ok).toBe(false);
    expect(buildPlace(input({ dur: "4" })).ok).toBe(false);
    expect(buildPlace(input({ dur: "601" })).ok).toBe(false);
    expect(buildPlace(input({ dur: "abc" })).ok).toBe(false);
  });
  it("좌표를 숫자로 저장하고, 알 수 없는 분류는 기타로", () => {
    const r = buildPlace(input({ lat: "35.81", lon: "127.15", cat: "hack" }));
    expect(r.ok && r.place).toMatchObject({ lat: 35.81, lon: 127.15, cat: "etc" });
  });
  it("HTML은 문자열 그대로 보관 (화면에서 React가 이스케이프)", () => {
    const r = buildPlace(input({ name: "<b>x</b>", note: "<script>1</script>" }));
    expect(r.ok && r.place.name).toBe("<b>x</b>");
  });
  it("긴 입력은 잘라낸다", () => {
    const r = buildPlace(input({ name: "가".repeat(200), note: "나".repeat(900) }));
    expect(r.ok && r.place.name.length).toBe(80);
    expect(r.ok && r.place.note!.length).toBe(500);
  });
});

describe("applyProgressPatch 소감/별점", () => {
  it("소감과 별점을 독립적으로 저장하고 다른 값은 보존한다", () => {
    const a = applyProgressPatch({ ...EMPTY_PROGRESS, memo: "예약함", status: "done" }, { review: "비빔밥이 맛있었어요", rating: 5 });
    expect(a.ok && a.state).toMatchObject({ memo: "예약함", status: "done", review: "비빔밥이 맛있었어요", rating: 5 });
  });
  it("별점은 1~5 정수, 소감은 1000자까지, null은 지우기", () => {
    for (const bad of [0, 6, 2.5, Number.NaN]) expect(applyProgressPatch(EMPTY_PROGRESS, { rating: bad }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { review: "가".repeat(1001) }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { review: "가".repeat(1000) }).ok).toBe(true);
    const cleared = applyProgressPatch({ ...EMPTY_PROGRESS, rating: 4 }, { rating: null });
    expect(cleared.ok && cleared.state.rating).toBeNull();
  });
});

describe("applyProgressPatch", () => {
  it("상태/메모/지출을 독립적으로 갱신하고 나머지는 보존", () => {
    const a = applyProgressPatch(EMPTY_PROGRESS, { status: "arrived" });
    const b = a.ok && applyProgressPatch(a.state, { memo: "예약함" });
    const c = b && b.ok && applyProgressPatch(b.state, { cost: 45000 });
    expect(c && c.ok && c.state).toEqual({ status: "arrived", checks: {}, memo: "예약함", cost: 45000, review: "", rating: null });
  });
  it("체크 항목은 인덱스별로 병합 (다른 항목 체크를 지우지 않음)", () => {
    const a = applyProgressPatch(EMPTY_PROGRESS, { checkIndex: 0, checked: true });
    const b = a.ok && applyProgressPatch(a.state, { checkIndex: 2, checked: true });
    const c = b && b.ok && applyProgressPatch(b.state, { checkIndex: 0, checked: false });
    expect(c && c.ok && c.state.checks).toEqual({ "0": false, "2": true });
  });
  it("입력을 바꾸지 않는다", () => {
    const cur = { ...EMPTY_PROGRESS, checks: { "0": true } };
    applyProgressPatch(cur, { checkIndex: 1, checked: true });
    expect(cur.checks).toEqual({ "0": true });
  });
  it("status null은 되돌리기", () => {
    const a = applyProgressPatch({ ...EMPTY_PROGRESS, status: "done" }, { status: null });
    expect(a.ok && a.state.status).toBeNull();
  });
  it("잘못된 값을 거부", () => {
    // @ts-expect-error 의도적으로 잘못된 상태
    expect(applyProgressPatch(EMPTY_PROGRESS, { status: "finished" }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { checkIndex: -1, checked: true }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { checkIndex: 1.5, checked: true }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { memo: "가".repeat(2001) }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { cost: -1 }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { cost: 1.5 }).ok).toBe(false);
    expect(applyProgressPatch(EMPTY_PROGRESS, { cost: 100_000_001 }).ok).toBe(false);
  });
});

describe("nextVersion (낙관적 잠금 버전)", () => {
  it("이전 버전보다 항상 엄격히 크다 (같은 밀리초에 두 번 저장해도 겹치지 않음)", () => {
    const t = Date.parse("2026-10-09T13:00:00.500Z");
    const v1 = nextVersion(null, t);
    const v2 = nextVersion(v1, t);
    const v3 = nextVersion(v2, t - 5000); // 시계가 뒤로 가도
    expect(Date.parse(v1)).toBe(t);
    expect(Date.parse(v2)).toBeGreaterThan(Date.parse(v1));
    expect(Date.parse(v3)).toBeGreaterThan(Date.parse(v2));
  });
  it("DB의 마이크로초 값(.123456)보다도 커진다", () => {
    const prev = "2026-10-09T13:00:00.123456+00:00";
    const next = nextVersion(prev, Date.parse("2026-10-09T13:00:00.123Z"));
    expect(Date.parse(next)).toBeGreaterThan(Date.parse("2026-10-09T13:00:00.123Z"));
    expect(next).not.toBe(prev);
  });
  it("시간이 충분히 지났으면 현재 시각을 쓴다", () => {
    const now = Date.parse("2026-10-09T14:00:00.000Z");
    expect(Date.parse(nextVersion("2026-10-09T13:00:00.000Z", now))).toBe(now);
  });
  it("파싱할 수 없는 이전 값은 무시", () => {
    expect(Date.parse(nextVersion("garbage", 1_000_000))).toBe(1_000_000);
  });
  it("재시도 횟수는 양수", () => {
    expect(MAX_CAS_ATTEMPTS).toBeGreaterThan(1);
  });
});

describe("applyDayOp setAt", () => {
  const items = [{ id: "i1", rest: "점심" }, { id: "i2", rest: "저녁", at: "18:00" }];
  const ctx = { places: [], mandatory: [] };
  it("시각을 지정하고, 해제하고, 입력 배열은 바꾸지 않는다", () => {
    const set = applyDayOp(items, { type: "setAt", itemId: "i1", at: "12:30" }, ctx);
    expect(set.ok && set.items[0].at).toBe("12:30");
    expect(items[0]).not.toHaveProperty("at");
    const cleared = applyDayOp(items, { type: "setAt", itemId: "i2", at: null }, ctx);
    expect(cleared.ok && cleared.items[1]).not.toHaveProperty("at");
  });
  it("잘못된 형식이나 없는 항목은 거부", () => {
    expect(applyDayOp(items, { type: "setAt", itemId: "i1", at: "25:00" }, ctx).ok).toBe(false);
    expect(applyDayOp(items, { type: "setAt", itemId: "nope", at: "10:00" }, ctx).ok).toBe(false);
  });
});

describe("applyDayOp setDur / setPlace / rename", () => {
  const places = [
    { id: "a", name: "A", dur: 30 },
    { id: "b", name: "B", dur: 45 },
    { id: "m", name: "필수", dur: 60 },
  ];
  const items = [
    { id: "i1", p: "a", dur: 90 },
    { id: "i2", rest: "이동" },
    { id: "i3", p: "m" },
  ];
  const ctx = { places, mandatory: ["m"] };

  it("setDur: 분 단위로 직접 지정 (5~600, 정수로 반올림)", () => {
    const r = applyDayOp(items, { type: "setDur", itemId: "i2", dur: 193 }, ctx);
    expect(r.ok && r.items[1].dur).toBe(193);
    expect(applyDayOp(items, { type: "setDur", itemId: "i2", dur: 12.4 }, ctx)).toMatchObject({ ok: true });
    for (const bad of [4, 601, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(applyDayOp(items, { type: "setDur", itemId: "i2", dur: bad }, ctx).ok).toBe(false);
    }
    expect(applyDayOp(items, { type: "setDur", itemId: "nope", dur: 30 }, ctx).ok).toBe(false);
  });

  it("setPlace: 블록의 장소를 바꾸고 이전 장소에 맞춘 체류시간은 버린다", () => {
    const r = applyDayOp(items, { type: "setPlace", itemId: "i1", placeId: "b" }, ctx);
    expect(r.ok && r.items[0]).toEqual({ id: "i1", p: "b" });
    expect(items[0]).toEqual({ id: "i1", p: "a", dur: 90 }); // 입력은 바뀌지 않는다
  });

  it("setPlace: 필수 방문지 블록, 장소 없는 일정, 없는 장소는 거부", () => {
    expect(applyDayOp(items, { type: "setPlace", itemId: "i3", placeId: "a" }, ctx).ok).toBe(false);
    expect(applyDayOp(items, { type: "setPlace", itemId: "i2", placeId: "a" }, ctx).ok).toBe(false);
    expect(applyDayOp(items, { type: "setPlace", itemId: "i1", placeId: "zzz" }, ctx).ok).toBe(false);
  });

  it("rename: 장소 없는 일정만, 공백 제거·60자 제한·빈 이름 거부", () => {
    const r = applyDayOp(items, { type: "rename", itemId: "i2", title: "  점심 이동  " }, ctx);
    expect(r.ok && r.items[1].rest).toBe("점심 이동");
    const long = applyDayOp(items, { type: "rename", itemId: "i2", title: "가".repeat(100) }, ctx);
    expect(long.ok && long.items[1].rest).toHaveLength(60);
    expect(applyDayOp(items, { type: "rename", itemId: "i2", title: "   " }, ctx).ok).toBe(false);
    expect(applyDayOp(items, { type: "rename", itemId: "i1", title: "x" }, ctx).ok).toBe(false);
  });
});

describe("setPlaceCoord (지도 위치 지정)", () => {
  const withCoord: Place[] = [
    { id: "a", name: "근사 장소", lat: 35.1, lon: 127.1, approx: true },
    { id: "b", name: "좌표 없음" },
  ];

  it("좌표를 정하면 소수 5자리로 반올림하고 '근사' 표시를 뗀다", () => {
    const r = setPlaceCoord(withCoord, "a", { lat: 35.812345678, lon: 127.150987654 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.places[0]).toMatchObject({ lat: 35.81235, lon: 127.15099 });
    expect(r.places[0].approx).toBeUndefined();
  });

  it("좌표 없던 장소에도 지정할 수 있고, 원본 배열은 바뀌지 않는다", () => {
    const r = setPlaceCoord(withCoord, "b", { lat: 35.8, lon: 127.1 });
    expect(r.ok && r.places[1]).toMatchObject({ lat: 35.8, lon: 127.1 });
    expect(withCoord[1].lat).toBeUndefined();
  });

  it("null이면 위치를 지운다", () => {
    const r = setPlaceCoord(withCoord, "a", null);
    expect(r.ok && r.places[0].lat).toBeUndefined();
    expect(r.ok && r.places[0].approx).toBeUndefined();
  });

  it("범위를 벗어난 좌표와 없는 장소는 거부한다", () => {
    expect(setPlaceCoord(withCoord, "a", { lat: 91, lon: 127 }).ok).toBe(false);
    expect(setPlaceCoord(withCoord, "a", { lat: Number.NaN, lon: 127 }).ok).toBe(false);
    expect(setPlaceCoord(withCoord, "zzz", { lat: 35, lon: 127 }).ok).toBe(false);
  });
});
