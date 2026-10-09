import { describe, expect, it } from "vitest";
import {
  currentIndex, directionsUrl, fmt, hasCoord, mandatoryStatus, move, timeline, toMin, travel, validCoord, validateTrip,
} from "../../src/lib/trip/engine";
import { jeonjuTemplate } from "../../src/lib/trip/templates/jeonju";
import type { Place, PlanItem } from "../../src/lib/trip/types";

const places = (list: Partial<Place>[]): Record<string, Place> =>
  Object.fromEntries(list.map((p) => [p.id!, { name: p.id!, ...p } as Place]));

describe("시간 변환", () => {
  it("HH:MM <-> 분", () => {
    expect(toMin("09:05")).toBe(545);
    expect(fmt(545)).toBe("09:05");
    expect(fmt(toMin("23:59") + 2)).toBe("00:01"); // 자정을 넘기면 다음 날 00시대
  });
  it("형식이 틀리면 09:00으로 대체", () => {
    expect(toMin("abc")).toBe(540);
  });
});

describe("좌표", () => {
  it("범위와 타입을 검증", () => {
    expect(validCoord(35.8, 127.1)).toBe(true);
    expect(validCoord(91, 0)).toBe(false);
    expect(validCoord(0, 181)).toBe(false);
    expect(validCoord("35", 127)).toBe(false);
    expect(validCoord(Number.NaN, 0)).toBe(false);
    expect(hasCoord(undefined)).toBe(false);
    expect(hasCoord({ id: "a", name: "a", lat: 1, lon: 2 })).toBe(true);
  });
});

describe("이동 추정", () => {
  const a = { id: "a", name: "a", lat: 35.8133, lon: 127.1497 };
  it("가까우면 도보(최소 3분), 멀면 차량", () => {
    const near = travel(a, { id: "b", name: "b", lat: 35.8152, lon: 127.15 });
    expect(near?.mode).toBe("walk");
    expect(near!.min).toBeGreaterThanOrEqual(3);
    const far = travel(a, { id: "c", name: "c", lat: 35.85, lon: 127.2 });
    expect(far?.mode).toBe("car");
    expect(far!.min).toBeGreaterThan(5);
  });
  it("같은 위치는 0분, 좌표가 없으면 null", () => {
    expect(travel(a, a)).toMatchObject({ mode: "walk", min: 0 });
    expect(travel(a, { id: "n", name: "n" })).toBeNull();
    expect(travel(undefined, a)).toBeNull();
  });
});

describe("타임라인", () => {
  const pl = places([
    { id: "a", dur: 30, lat: 35.8133, lon: 127.1497 },
    { id: "b", dur: 60, lat: 35.8152, lon: 127.15 },
    { id: "c", dur: 45 },
  ]);
  const items: PlanItem[] = [{ id: "1", p: "a" }, { id: "2", p: "b" }, { id: "3", p: "c" }];

  it("순서대로 시각이 이어지고 이동 시간이 더해진다", () => {
    const rows = timeline(items, pl, "10:00");
    expect(rows[0].start).toBe(600);
    expect(rows[0].end).toBe(630);
    expect(rows[1].travel).not.toBeNull();
    expect(rows[1].start).toBe(630 + rows[1].travel!.min);
    rows.forEach((r, i) => { if (i) expect(r.start!).toBeGreaterThanOrEqual(rows[i - 1].end!); });
  });
  it("제외된 항목은 시간 없이 건너뛰고 뒤 일정이 당겨진다", () => {
    const full = timeline(items, pl, "10:00");
    const cut = timeline(items.map((i) => (i.id === "2" ? { ...i, included: false } : i)), pl, "10:00");
    expect(cut[1].start).toBeNull();
    expect(cut[1].included).toBe(false);
    expect(cut[2].end!).toBeLessThan(full[2].end!);
  });
  it("dur가 있으면 장소 기본값보다 우선하고, 둘 다 없으면 30분", () => {
    const rows = timeline([{ id: "x", rest: "휴식", dur: 20 }, { id: "y", rest: "이동" }], {}, "08:00");
    expect(rows[0].dur).toBe(20);
    expect(rows[1].dur).toBe(30);
    expect(rows[1].start).toBe(480 + 20);
  });
  it("좌표 없는 항목을 사이에 두면 그 앞 장소 기준으로 이동을 계산한다", () => {
    const rows = timeline([{ id: "1", p: "a" }, { id: "r", rest: "휴식" }, { id: "2", p: "b" }], pl, "10:00");
    expect(rows[2].travel).not.toBeNull();
  });
});

describe("필수 방문지", () => {
  const days = {
    "1": [{ id: "1", p: "m1" }, { id: "2", p: "x" }] as PlanItem[],
    "2": [{ id: "3", p: "m2", included: false }] as PlanItem[],
  };
  it("누락과 제외를 구분한다", () => {
    expect(mandatoryStatus(["m1", "m2", "m3"], days)).toEqual({ missing: ["m3"], excluded: ["m2"] });
  });
  it("다른 날에 포함돼 있으면 제외로 보지 않는다", () => {
    const d = { ...days, "3": [{ id: "9", p: "m2" }] as PlanItem[] };
    expect(mandatoryStatus(["m2"], d)).toEqual({ missing: [], excluded: [] });
  });
});

describe("move", () => {
  const items: PlanItem[] = [{ id: "1", p: "m1" }, { id: "2", p: "m2" }, { id: "3", p: "x" }];
  it("필수끼리 교환은 거부하고 입력을 바꾸지 않는다", () => {
    const r = move(items, 0, 1, ["m1", "m2"]);
    expect(r.ok).toBe(false);
    expect(items.map((i) => i.id)).toEqual(["1", "2", "3"]);
  });
  it("필수와 일반은 교환 가능", () => {
    const r = move(items, 1, 1, ["m1", "m2"]);
    expect(r.ok && r.items.map((i) => i.id)).toEqual(["1", "3", "2"]);
  });
  it("범위를 벗어나면 거부", () => {
    expect(move(items, 0, -1, []).ok).toBe(false);
    expect(move(items, 2, 1, []).ok).toBe(false);
    expect(move(items, 9, 1, []).ok).toBe(false);
  });
});

describe("currentIndex", () => {
  const items: PlanItem[] = [{ id: "1" }, { id: "2", included: false }, { id: "3" }];
  it("완료/건너뜀/제외를 지나 첫 진행 대상을 찾는다", () => {
    expect(currentIndex(items, {})).toBe(0);
    expect(currentIndex(items, { "1": "done" })).toBe(2); // 2번은 제외라 건너뜀
    expect(currentIndex(items, { "1": "done", "3": "skipped" })).toBe(-1);
    expect(currentIndex(items, { "1": "arrived" })).toBe(0); // 도착만 한 곳은 아직 진행 중
  });
});

describe("길찾기 URL", () => {
  it("좌표가 있으면 좌표로, 없으면 주소/이름으로", () => {
    expect(directionsUrl({ id: "a", name: "A", lat: 35.1, lon: 127.2 }, "walk")).toContain("destination=35.1%2C127.2&travelmode=walking");
    expect(directionsUrl({ id: "a", name: "A", addr: "전주시 완산구" }, "car")).toContain(`destination=${encodeURIComponent("전주시 완산구")}&travelmode=driving`);
    expect(directionsUrl({ id: "a", name: "A" }, "walk")).toContain("destination=A");
  });
  it("특수문자를 인코딩해 URL 파라미터를 깨지 못한다", () => {
    const url = directionsUrl({ id: "a", name: "a&travelmode=x#y" }, "walk");
    expect(url.split("destination=")[1]).toContain("%26");
    expect(url).not.toContain("#");
  });
});

describe("validateTrip", () => {
  const clone = () => structuredClone(jeonjuTemplate);
  it("전주 템플릿은 유효하고 모든 대안에 필수 방문지가 포함돼 있다", () => {
    expect(validateTrip(jeonjuTemplate)).toEqual([]);
    for (const plan of Object.values(jeonjuTemplate.plans)) {
      expect(mandatoryStatus(jeonjuTemplate.mandatory ?? [], plan.days)).toEqual({ missing: [], excluded: [] });
    }
  });
  it("잘못된 입력을 거부한다", () => {
    expect(validateTrip(null)).not.toEqual([]);
    expect(validateTrip("x")).not.toEqual([]);
    expect(validateTrip({})).not.toEqual([]);
  });
  it("좌표·참조·중복 오류를 잡는다", () => {
    const t = clone();
    t.places[0].lat = 200;
    t.plans.balanced.days["1"][0].p = "nope";
    t.mandatory = ["zzz"];
    t.places.push({ ...t.places[1] });
    const errs = validateTrip(t);
    expect(errs.length).toBeGreaterThanOrEqual(4);
  });
  it("일차 번호가 순서대로가 아니거나 30일을 넘으면 거부", () => {
    const t = clone();
    t.days[1].n = 5;
    expect(validateTrip(t).length).toBeGreaterThan(0);
    const big = clone();
    big.days = Array.from({ length: 31 }, (_, i) => ({ n: i + 1, start: "09:00" }));
    expect(validateTrip(big).length).toBeGreaterThan(0);
  });
});
