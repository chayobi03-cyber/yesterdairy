// 순수 일정 로직 (DOM/Supabase 비의존). 시간·이동은 계획용 추정치일 뿐이며
// 실시간 교통/대기열은 반영하지 않는다.
import type { Place, PlanItem, TripDef } from "./types";

export const CATS: Record<string, string> = {
  sight: "관광", food: "먹거리", activity: "체험", show: "공연", parking: "주차", stay: "숙소", etc: "기타",
};

// 지도 핀/범례 색 (카테고리별). 참고한 원본 지도의 구성: 관광·숙소 / 먹거리 / 공연 / 체험.
export const CAT_COLORS: Record<string, string> = {
  sight: "#536b56", stay: "#536b56", food: "#b96650", show: "#567d95", activity: "#8c77a3", parking: "#6b7280", etc: "#6b7280",
};
export const LEGEND: { label: string; color: string; cats: string[] }[] = [
  { label: "관광·숙소", color: "#536b56", cats: ["sight", "stay"] },
  { label: "먹거리", color: "#b96650", cats: ["food"] },
  { label: "공연", color: "#567d95", cats: ["show"] },
  { label: "체험", color: "#8c77a3", cats: ["activity"] },
  { label: "주차·기타", color: "#6b7280", cats: ["parking", "etc"] },
];
export const catColor = (cat?: string) => CAT_COLORS[cat ?? "etc"] ?? CAT_COLORS.etc;

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

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
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

// 고정 시각 형식 "HH:MM" (00:00~23:59)
export const AT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const validAt = (v: unknown): v is string => typeof v === "string" && AT_RE.test(v);

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
  // 고정 시각(at)보다 일찍 도착해 기다리는 분 / 늦게 도착한 분
  wait: number;
  late: number;
};

export function timeline(items: PlanItem[], places: Record<string, Place>, startTime: string): Row[] {
  let t = toMin(startTime);
  let prev: Place | null = null;
  return items.map((item) => {
    const place = item.p ? (places[item.p] ?? null) : null;
    const dur = Math.max(0, Number(item.dur ?? place?.dur ?? 30));
    const row: Row = { item, place, dur, included: item.included !== false, start: null, end: null, travel: null, wait: 0, late: 0 };
    if (row.included) {
      if (prev && place) {
        const tr = travel(prev, place);
        if (tr) {
          row.travel = tr;
          t += tr.min;
        }
      }
      if (validAt(item.at)) {
        const target = toMin(item.at);
        if (t < target) {
          row.wait = target - t;
          t = target;
        } else {
          row.late = t - target;
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

// 국내에서는 구글 지도가 차량 길찾기를 지원하지 않고 도보도 부정확해서, 카카오맵·네이버지도로도 열 수 있게 한다.
// 카카오맵 링크(앱키 불필요): 좌표가 있으면 "도착지=장소"로 길찾기(출발은 내 위치), 없으면 주소/이름 검색.
export function kakaoMapUrl(p: Place): string {
  if (hasCoord(p)) return `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lon}`;
  return `https://map.kakao.com/link/search/${encodeURIComponent(p.addr || p.name)}`;
}

// 네이버지도: 주소/이름 검색 (좌표 기반 길찾기 URL은 공식 형식이 불안정해 검색으로 연다)
export function naverMapUrl(p: Place): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(p.addr || p.name)}`;
}

// 거리 표시: 1km 미만은 m(10m 단위), 이상은 km(소수 1자리)
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)}m`;
  return `${km.toFixed(1)}km`;
}

// Google 지도 다중 경유 길찾기 URL: 첫 장소 -> 마지막 장소, 사이는 경유지.
// 웹 URL은 경유지를 최대 9개까지만 받으므로 넘치면 앞쪽 11곳만 쓰고 truncated를 true로 돌려준다.
export function routeUrl(stops: Place[], mode: "walk" | "car"): { url: string; truncated: boolean } | null {
  const usable = stops.filter((p) => hasCoord(p) || p.addr || p.name);
  if (usable.length < 2) return null;
  const MAX = 11;
  const used = usable.slice(0, MAX);
  const ref = (p: Place) => (hasCoord(p) ? `${p.lat},${p.lon}` : p.addr || p.name);
  const q = new URLSearchParams({
    api: "1",
    origin: ref(used[0]),
    destination: ref(used[used.length - 1]),
    travelmode: mode === "car" ? "driving" : "walking",
  });
  if (used.length > 2) q.set("waypoints", used.slice(1, -1).map(ref).join("|"));
  return { url: `https://www.google.com/maps/dir/?${q.toString()}`, truncated: usable.length > MAX };
}

// 목록을 드래그할 때 손가락 y좌표가 몇 번째 칸 위인지 (칸 중앙선을 넘으면 그 칸으로 이동)
export function dragTargetIndex(rects: { top: number; bottom: number }[], y: number): number {
  if (!rects.length) return 0;
  for (let i = 0; i < rects.length; i++) {
    if (y < (rects[i].top + rects[i].bottom) / 2) return i;
  }
  return rects.length - 1;
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
          if (it.at != null && !validAt(it.at)) errs.push(`plans.${k} ${day}일차 ${it.id}: at은 HH:MM 형식이어야 해요.`);
        }
      }
    }
  }
  (d.mandatory ?? []).forEach((m) => { if (!ids.has(m)) errs.push(`mandatory: 알 수 없는 장소 ${m}`); });
  return errs;
}
