// 여행 요약: 진행 기록·소감·사진을 모아 보여주는 결정론적 계산 (AI/외부 API 없음).
// 같은 입력이면 항상 같은 결과가 나온다 — 한 줄 요약과 배지는 고정된 문장 틀과 임계값 규칙으로만 만든다.
import { buildRows } from "./view-model";
import type { TripSnapshot } from "./view-model";
import { TRIP_NOTE_ID, type ProgressStatus, type TripPhoto } from "./types";

export type SummaryStop = {
  id: string;
  number: number;
  title: string;
  cat?: string;
  start: number | null;
  end: number | null;
  status: ProgressStatus | null;
  rating: number | null;
  review: string;
  memo: string;
  cost: number | null;
  photos: TripPhoto[];
};

export type SummaryDay = {
  n: number;
  label: string;
  stops: SummaryStop[];
  excludedCount: number;
  cost: number;
  done: number;
  planned: number;
};

export type TripSummary = {
  headline: string;
  badges: string[];
  totals: {
    days: number;
    planned: number;
    done: number;
    arrived: number;
    skipped: number;
    notVisited: number;
    excluded: number;
    cost: number;
    photos: number;
    rated: number;
    avgRating: number | null;
    reviews: number;
    walkKm: number;
  };
  highlights: SummaryStop[];
  days: SummaryDay[];
  tripNote: { review: string; rating: number | null };
  tripPhotos: TripPhoto[];
};

export const fmtWon = (n: number) => `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}원`;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function buildTripSummary(s: TripSnapshot, plan: string): TripSummary {
  const days: SummaryDay[] = [];
  let walkKm = 0;

  for (const d of s.def.days) {
    const rows = buildRows(s, plan, d.n);
    const stops: SummaryStop[] = [];
    let cost = 0;
    for (const r of rows) {
      if (!r.included || r.number == null) continue;
      const pr = s.progress[r.id];
      const c = pr?.cost ?? 0;
      cost += c;
      // 도보 거리는 실제로 다녀온 곳(도착/완료)으로 가는 구간만 센다
      if ((r.status === "done" || r.status === "arrived") && r.travel?.mode === "walk") walkKm += r.travel.km;
      stops.push({
        id: r.id,
        number: r.number,
        title: r.place?.name ?? r.item.rest ?? "일정",
        cat: r.place?.cat,
        start: r.start,
        end: r.end,
        status: r.status,
        rating: pr?.rating ?? null,
        review: pr?.review ?? "",
        memo: pr?.memo ?? "",
        cost: pr?.cost ?? null,
        photos: s.photos.filter((p) => p.itemId === r.id),
      });
    }
    days.push({
      n: d.n,
      label: d.label ?? `${d.n}일차`,
      stops,
      excludedCount: rows.filter((r) => !r.included).length,
      cost,
      done: stops.filter((x) => x.status === "done").length,
      planned: stops.length,
    });
  }

  const all = days.flatMap((d) => d.stops);
  const done = all.filter((x) => x.status === "done").length;
  const arrived = all.filter((x) => x.status === "arrived").length;
  const skipped = all.filter((x) => x.status === "skipped").length;
  const rated = all.filter((x) => x.rating != null);
  const avg = rated.length ? round1(rated.reduce((a, x) => a + (x.rating ?? 0), 0) / rated.length) : null;
  const reviews = all.filter((x) => x.review.trim()).length;
  const cost = days.reduce((a, d) => a + d.cost, 0);
  const tripPhotos = s.photos.filter((p) => p.itemId == null);
  const note = s.progress[TRIP_NOTE_ID];

  // 가장 좋았던 곳: 별점 4 이상을 높은 순으로, 같으면 여행 순서대로 (랜덤 없음)
  const highlights = all
    .map((x, i) => ({ x, i }))
    .filter(({ x }) => (x.rating ?? 0) >= 4)
    .sort((a, b) => (b.x.rating ?? 0) - (a.x.rating ?? 0) || a.i - b.i)
    .slice(0, 3)
    .map(({ x }) => x);

  const totals = {
    days: s.def.days.length,
    planned: all.length,
    done,
    arrived,
    skipped,
    notVisited: all.length - done - arrived - skipped,
    excluded: days.reduce((a, d) => a + d.excludedCount, 0),
    cost,
    photos: s.photos.length,
    rated: rated.length,
    avgRating: avg,
    reviews,
    walkKm: round1(walkKm),
  };

  return {
    headline: headline(s, totals, highlights[0]),
    badges: badges(totals),
    totals,
    highlights,
    days,
    tripNote: { review: note?.review ?? "", rating: note?.rating ?? null },
    tripPhotos,
  };
}

function headline(s: TripSnapshot, t: TripSummary["totals"], top: SummaryStop | undefined): string {
  const place = s.def.dest || s.title;
  const visited = t.done + t.arrived;
  if (visited === 0) return `${place} 여행 — 아직 다녀온 곳이 없어요. 장소를 완료하면 여기에 요약이 채워져요.`;
  let text = `${place} ${t.days}일 동안 ${visited}곳을 다녀왔어요`;
  if (t.cost > 0) text += `, ${fmtWon(t.cost)}을 썼어요`;
  text += ".";
  if (top) text += ` 가장 좋았던 곳은 ${top.title}(${"★".repeat(top.rating ?? 0)})예요.`;
  return text;
}

// 고정된 임계값으로만 정하는 배지
function badges(t: TripSummary["totals"]): string[] {
  const out: string[] = [];
  if (t.planned > 0 && t.done === t.planned) out.push("✅ 계획 완주");
  if (t.walkKm >= 5) out.push(`🚶 많이 걸은 여행 (약 ${t.walkKm}km)`);
  if (t.photos >= 10) out.push(`📸 사진 ${t.photos}장`);
  if (t.rated >= 3 && t.avgRating != null && t.avgRating >= 4.5) out.push("😊 대만족");
  if (t.reviews >= 5) out.push(`✍️ 소감 ${t.reviews}개`);
  return out;
}
