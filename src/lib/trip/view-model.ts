// 화면이 쓰는 여행 상태와 그 변환 (DB/React 비의존). 서버에서 받은 스냅샷을 클라이언트가
// 들고 있다가, 탭할 때마다 여기 함수들로 "먼저 반영"하고 서버 액션은 뒤에서 저장한다.
import { applyDayOp, type DayOp, type NewPlaceInput, buildPlace } from "./day-ops";
import { currentIndex, hasCoord, mandatoryStatus, timeline, type Row } from "./engine";
import { applyProgressPatch, EMPTY_PROGRESS, type ProgressPatch } from "./progress";
import type { Place, PlanItem, ProgressRow, TripDef, TripPhoto } from "./types";

export type TripSnapshot = {
  tripId: string;
  title: string;
  startDate: string | null;
  def: TripDef;
  // "planId:day" -> 편집된 일정 (없으면 def의 기본 일정)
  overrides: Record<string, PlanItem[]>;
  // 항목 id -> 진행 기록
  progress: Record<string, ProgressRow>;
  // 업로드 순서의 사진 목록 (서명 URL 포함)
  photos: TripPhoto[];
};

export const dayKey = (plan: string, day: number) => `${plan}:${day}`;

export function getDayItems(s: TripSnapshot, plan: string, day: number): PlanItem[] {
  return s.overrides[dayKey(plan, day)] ?? s.def.plans[plan]?.days[String(day)] ?? [];
}

export function placesById(def: TripDef): Record<string, Place> {
  return Object.fromEntries(def.places.map((p) => [p.id, p]));
}

export type DayOpOrReset = DayOp | { type: "reset" };

export function applyOp(
  s: TripSnapshot,
  plan: string,
  day: number,
  op: DayOpOrReset,
): { ok: true; snapshot: TripSnapshot } | { ok: false; error: string } {
  const key = dayKey(plan, day);
  if (op.type === "reset") {
    const overrides = { ...s.overrides };
    delete overrides[key];
    return { ok: true, snapshot: { ...s, overrides } };
  }
  const r = applyDayOp(getDayItems(s, plan, day), op, { places: s.def.places, mandatory: s.def.mandatory ?? [] });
  if (!r.ok) return r;
  return { ok: true, snapshot: { ...s, overrides: { ...s.overrides, [key]: r.items } } };
}

export function applyProgress(
  s: TripSnapshot,
  itemId: string,
  patch: ProgressPatch,
): { ok: true; snapshot: TripSnapshot } | { ok: false; error: string } {
  const cur = s.progress[itemId];
  const r = applyProgressPatch(cur ? { status: cur.status, checks: cur.checks, memo: cur.memo, cost: cur.cost, review: cur.review ?? "", rating: cur.rating ?? null } : EMPTY_PROGRESS, patch);
  if (!r.ok) return r;
  const row: ProgressRow = { item_id: itemId, updated_at: cur?.updated_at ?? "", ...r.state };
  return { ok: true, snapshot: { ...s, progress: { ...s.progress, [itemId]: row } } };
}

export function applyNewPlace(
  s: TripSnapshot,
  input: NewPlaceInput,
  id: string,
): { ok: true; snapshot: TripSnapshot; place: Place } | { ok: false; error: string } {
  const built = buildPlace(input, id);
  if (!built.ok) return built;
  if (s.def.places.some((p) => p.id === id)) return { ok: false, error: "이미 있는 장소 id예요." };
  return { ok: true, place: built.place, snapshot: { ...s, def: { ...s.def, places: [...s.def.places, built.place] } } };
}

export type StopRow = Row & { id: string; status: ProgressRow["status"] | null; number: number | null };

// 하루 일정을 시간 계산 + 진행 상태 + 포함된 항목의 1부터 시작하는 번호로 묶는다
export function buildRows(s: TripSnapshot, plan: string, day: number): StopRow[] {
  const start = s.def.days.find((d) => d.n === day)?.start ?? "09:00";
  let n = 0;
  return timeline(getDayItems(s, plan, day), placesById(s.def), start).map((r) => ({
    ...r,
    id: r.item.id,
    status: s.progress[r.item.id]?.status ?? null,
    number: r.included ? ++n : null,
  }));
}

// 지금 가야 할 곳: 완료/건너뜀이 아닌 첫 번째 포함 항목
export function currentStopId(s: TripSnapshot, plan: string, day: number): string | null {
  const items = getDayItems(s, plan, day);
  const status = Object.fromEntries(items.map((i) => [i.id, s.progress[i.id]?.status ?? null]));
  const idx = currentIndex(items, status);
  return idx >= 0 ? items[idx].id : null;
}

// 특정 항목 다음의 진행 대상 (없으면 null)
export function nextStopId(rows: StopRow[], afterId: string): string | null {
  const i = rows.findIndex((r) => r.id === afterId);
  const next = rows.slice(i + 1).find((r) => r.included && r.status !== "done" && r.status !== "skipped");
  return next?.id ?? null;
}

export function dayStats(rows: StopRow[]) {
  const inc = rows.filter((r) => r.included);
  const done = inc.filter((r) => r.status === "done").length;
  const skipped = inc.filter((r) => r.status === "skipped").length;
  return { total: inc.length, done, skipped, percent: inc.length ? Math.round(((done + skipped) / inc.length) * 100) : 0 };
}

export type DaySummary = {
  startMin: number | null;
  endMin: number | null;
  walkKm: number;
  walkMin: number;
  carKm: number;
  carMin: number;
  waitMin: number;
  lateCount: number;
};

// 하루 요약: 시작/끝, 이동거리·시간(도보/차량), 고정 시각 때문에 기다리는 시간, 늦는 항목 수
export function daySummary(rows: StopRow[]): DaySummary {
  const inc = rows.filter((r) => r.included && r.start != null && r.end != null);
  const out: DaySummary = { startMin: inc[0]?.start ?? null, endMin: inc.length ? inc[inc.length - 1].end : null, walkKm: 0, walkMin: 0, carKm: 0, carMin: 0, waitMin: 0, lateCount: 0 };
  for (const r of inc) {
    if (r.travel?.mode === "walk") { out.walkKm += r.travel.km; out.walkMin += r.travel.min; }
    if (r.travel?.mode === "car") { out.carKm += r.travel.km; out.carMin += r.travel.min; }
    out.waitMin += r.wait;
    if (r.late > 0) out.lateCount++;
  }
  return out;
}

export function totalCost(s: TripSnapshot): number {
  return Object.values(s.progress).reduce((sum, p) => sum + (p.cost ?? 0), 0);
}

export function excludedMandatory(s: TripSnapshot, plan: string): string[] {
  const placeMap = placesById(s.def);
  const mand = (s.def.mandatory ?? []).filter((m) => placeMap[m]);
  const days: Record<string, PlanItem[]> = {};
  for (const d of s.def.days) days[String(d.n)] = getDayItems(s, plan, d.n);
  return mandatoryStatus(mand, days).excluded.map((id) => placeMap[id].name);
}

export function dayLabel(s: TripSnapshot, n: number): string {
  const base = s.def.days.find((d) => d.n === n)?.label ?? `${n}일차`;
  if (!s.startDate) return base;
  const d = new Date(`${s.startDate}T12:00:00`);
  d.setDate(d.getDate() + n - 1);
  return `${base} (${d.getMonth() + 1}/${d.getDate()})`;
}

// 서버가 보낸 새 스냅샷을 받아들일지 판단하는 지문 (내용이 같으면 화면을 건드리지 않는다)
export function snapshotSignature(s: TripSnapshot): string {
  // 사진은 서명 URL이 매번 달라지므로 id만 비교한다 (그렇지 않으면 폴링 때마다 화면이 갈아끼워진다)
  return JSON.stringify([s.title, s.startDate, s.def, s.overrides, s.progress, s.photos.map((p) => p.id)]);
}

export type MapStop = {
  id: string;
  number: number;
  name: string;
  cat?: string;
  lat: number;
  lon: number;
  addr?: string;
  hours?: string;
  status: ProgressRow["status"] | null;
};

// 오늘 동선: 포함된 항목 중 좌표가 있는 곳만, 목록과 같은 번호로
export function routeStops(rows: StopRow[]): MapStop[] {
  const out: MapStop[] = [];
  for (const r of rows) {
    const p = r.place;
    if (!r.included || r.number == null || !hasCoord(p)) continue;
    out.push({ id: r.id, number: r.number, name: p.name, cat: p.cat, lat: p.lat, lon: p.lon, addr: p.addr, hours: p.hours, status: r.status });
  }
  return out;
}

export type CandidatePin = { placeId: string; name: string; cat?: string; lat: number; lon: number; addr?: string; hours?: string };

// "전체 장소" 보기: 오늘 일정에 아직 없는 좌표 있는 장소 (일정에 추가할 후보)
export function candidatePins(s: TripSnapshot, rows: StopRow[]): CandidatePin[] {
  const used = new Set(rows.filter((r) => r.included && r.item.p).map((r) => r.item.p));
  return s.def.places
    .filter((p) => hasCoord(p) && !used.has(p.id))
    .map((p) => ({ placeId: p.id, name: p.name, cat: p.cat, lat: p.lat as number, lon: p.lon as number, addr: p.addr, hours: p.hours }));
}
