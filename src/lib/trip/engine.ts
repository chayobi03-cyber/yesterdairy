// 순수 일정 로직 (DOM/Supabase 비의존). 시간·이동은 계획용 추정치일 뿐이며
// 실시간 교통/대기열은 반영하지 않는다.
import type { Place, PlanItem, TripDef } from "./types";

export const CATS: Record<string, string> = {
  sight: "관광", food: "먹거리", activity: "체험", show: "공연", parking: "주차", stay: "숙소", etc: "기타",
};

export function uid(prefix = "i"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function validCoord(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

export function hasCoord(p?: Place | null): p is Place & { lat: number; lon: number } {
  return !!p && validCoord(p.lat, p.lon);
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export type Travel = { mode: "walk" | "car"; min: number; km: number };

export function travel(a?: Place, b?: Place): Travel | null {
  if (!hasCoord(a) || !hasCoord(b)) return null;
  const km = haversineKm(a, b);
  if (km < 0.05) return { mode: "walk", min: 0, km };
  if (km <= 1.2) return { mode: "walk", min: Math.max(3, Math.round(((km * 1.3) / 4) * 60)), km };
  return { mode: "car", min: Math.round(((km * 1.4) / 25) * 60) + 5, km };
}

export function toMin(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : 9 * 60;
}

export function fmt(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export type Row = {
  item: PlanItem;
  place: Place | null;
  dur: number;
  included: boolean;
  start: number | null;
  end: number | null;
  travel: Travel | null;
};

export function timeline(items: PlanItem[], places: Record<string, Place>, startTime: string): Row[] {
  let t = toMin(startTime);
  let prev: Place | null = null;
  return items.map((item) => {
    const place = item.p ? (places[item.p] ?? null) : null;
    const dur = Math.max(0, Number(item.dur ?? place?.dur ?? 30));
    const row: Row = { item, place, dur, included: item.included !== false, start: null, end: null, travel: null };
    if (row.included) {
      if (prev && place) {
        const tr = travel(prev, place);
        if (tr) {
          row.travel = tr;
          t += tr.min;
        }
      }
      row.start = t;
      t += dur;
      row.end = t;
      if (place) prev = place;
    }
    return row;
  });
}

export function mandatoryStatus(mandatory: string[], days: Record<string, PlanItem[]>) {
  const seen: Record<string, "in" | "out"> = {};
  for (const items of Object.values(days)) {
    for (const it of items) {
      if (it.p && mandatory.includes(it.p)) seen[it.p] = seen[it.p] === "in" || it.included !== false ? "in" : "out";
    }
  }
  return {
    missing: mandatory.filter((id) => !seen[id]),
    excluded: mandatory.filter((id) => seen[id] === "out"),
  };
}

// 필수 방문지끼리의 순서 교환은 임의로 적용하지 않는다.
export function move(items: PlanItem[], idx: number, dir: 1 | -1, mandatory: string[]):
  | { ok: true; items: PlanItem[] }
  | { ok: false; reason: string } {
  const to = idx + dir;
  if (idx < 0 || idx >= items.length || to < 0 || to >= items.length) return { ok: false, reason: "더 이상 이동할 수 없어요." };
  const a = items[idx];
  const b = items[to];
  if (a.p && b.p && mandatory.includes(a.p) && mandatory.includes(b.p)) {
    return { ok: false, reason: "필수 방문지끼리의 순서는 임의로 바꾸지 않아요." };
  }
  const out = items.slice();
  out[idx] = b;
  out[to] = a;
  return { ok: true, items: out };
}

export function currentIndex(items: PlanItem[], status: Record<string, string | null | undefined>): number {
  return items.findIndex((it) => it.included !== false && status[it.id] !== "done" && status[it.id] !== "skipped");
}

export function directionsUrl(p: Place, mode: "walk" | "car"): string {
  const dest = hasCoord(p) ? `${p.lat},${p.lon}` : (p.addr || p.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=${mode === "car" ? "driving" : "walking"}`;
}

// 여행 정의(JSON) 검증. 가져오기·생성 시 서버에서 사용한다.
export function validateTrip(t: unknown): string[] {
  const errs: string[] = [];
  if (!t || typeof t !== "object") return ["여행 데이터가 객체가 아니에요."];
  const d = t as Partial<TripDef>;
  if (!Array.isArray(d.days) || !d.days.length) errs.push("days가 비어 있어요.");
  else if (d.days.length > 30) errs.push("days는 30일 이하여야 해요.");
  else d.days.forEach((x, i) => { if (!x || x.n !== i + 1) errs.push(`days[${i}].n은 ${i + 1}이어야 해요.`); });
  if (!Array.isArray(d.places)) errs.push("places가 배열이 아니에요.");
  const ids = new Set<string>();
  (d.places ?? []).forEach((p, i) => {
    if (!p || !p.id || !p.name) { errs.push(`places[${i}]에 id/name이 필요해요.`); return; }
    if (ids.has(p.id)) errs.push(`장소 id 중복: ${p.id}`);
    ids.add(p.id);
    if ((p.lat != null || p.lon != null) && !validCoord(p.lat, p.lon)) errs.push(`${p.name}: 좌표가 올바르지 않아요.`);
    if (p.dur != null && !(Number(p.dur) >= 0)) errs.push(`${p.name}: dur가 올바르지 않아요.`);
  });
  if (!d.plans || typeof d.plans !== "object" || !Object.keys(d.plans).length) errs.push("plans가 필요해요.");
  else {
    for (const [k, plan] of Object.entries(d.plans)) {
      if (!plan?.days) { errs.push(`plans.${k}.days가 필요해요.`); continue; }
      for (const [day, items] of Object.entries(plan.days)) {
        for (const it of items ?? []) {
          if (!it.id) errs.push(`plans.${k} ${day}일차 항목에 id가 필요해요.`);
          if (it.p && !ids.has(it.p)) errs.push(`plans.${k}: 알 수 없는 장소 ${it.p}`);
        }
      }
    }
  }
  (d.mandatory ?? []).forEach((m) => { if (!ids.has(m)) errs.push(`mandatory: 알 수 없는 장소 ${m}`); });
  return errs;
}
