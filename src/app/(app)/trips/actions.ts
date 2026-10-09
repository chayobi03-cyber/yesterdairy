"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { dayItems, loadTrip, loadTripState } from "@/lib/trip/data";
import { move, uid, validCoord, validateTrip } from "@/lib/trip/engine";
import { jeonjuTemplate } from "@/lib/trip/templates/jeonju";
import type { Place, PlanItem, ProgressStatus, TripDef } from "@/lib/trip/types";

// 사용자 입력 오류는 throw 대신 결과 객체로 돌려준다 (프로덕션에서 throw 메시지는 가려짐).
export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const TEMPLATES: Record<string, TripDef> = { jeonju: jeonjuTemplate };
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

async function ctx() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, supabase: await createClient() };
}

const NOT_SIGNED_IN = { ok: false, error: "로그인이 필요해요." } as const;

export async function createTrip(input: {
  source: "template" | "json" | "blank";
  templateId?: string;
  json?: string;
  title?: string;
  days?: number;
  startDate?: string;
}): Promise<Result<{ id: string }>> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  const { supabase, user } = c;

  let def: TripDef;
  if (input.source === "template") {
    const t = TEMPLATES[input.templateId ?? ""];
    if (!t) return { ok: false, error: "알 수 없는 템플릿이에요." };
    def = structuredClone(t);
  } else if (input.source === "json") {
    if ((input.json ?? "").length > 300_000) return { ok: false, error: "파일이 너무 커요 (300KB 이하)." };
    try {
      def = JSON.parse(input.json ?? "");
    } catch {
      return { ok: false, error: "JSON 형식이 올바르지 않아요." };
    }
    const errs = validateTrip(def);
    if (errs.length) return { ok: false, error: `가져오기 실패: ${errs.slice(0, 2).join(" / ")}` };
  } else {
    const n = Math.min(14, Math.max(1, Math.floor(Number(input.days) || 1)));
    const days = Array.from({ length: n }, (_, i) => ({ n: i + 1, label: `${i + 1}일차`, start: "10:00" }));
    def = {
      days, places: [], mandatory: [], defaultPlan: "main",
      plans: { main: { label: "내 일정", desc: "직접 구성하는 일정", days: Object.fromEntries(days.map((d) => [String(d.n), []])) } },
    };
  }

  const title = (input.title?.trim() || def.title || "").slice(0, 100);
  if (!title) return { ok: false, error: "여행 이름을 입력해주세요." };
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(input.startDate ?? "") ? input.startDate! : null;

  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return { ok: false, error: "가족에 먼저 참여해주세요." };

  const { data, error } = await supabase
    .from("trips")
    .insert({ family_id: membership.family_id, created_by: user.id, title, def, start_date: startDate })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/trips");
  return { ok: true, id: data.id };
}

export async function deleteTrip(tripId: string): Promise<Result> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  const { error } = await c.supabase.from("trips").delete().eq("id", tripId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/trips");
  return { ok: true };
}

/* ---------- 장소별 진행 기록 ---------- */

type ProgressPatch = Partial<{ status: ProgressStatus | null; checkIndex: number; checked: boolean; memo: string; cost: number | null }>;

export async function updateProgress(tripId: string, itemId: string, patch: ProgressPatch): Promise<Result> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  if (!ID_RE.test(itemId)) return { ok: false, error: "잘못된 항목이에요." };
  const { supabase, user } = c;

  const { data: existing } = await supabase
    .from("trip_progress")
    .select("status, checks, memo, cost")
    .eq("trip_id", tripId)
    .eq("item_id", itemId)
    .maybeSingle();

  const row = {
    trip_id: tripId,
    item_id: itemId,
    status: existing?.status ?? null,
    checks: (existing?.checks ?? {}) as Record<string, boolean>,
    memo: existing?.memo ?? "",
    cost: existing?.cost ?? null,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  };

  if ("status" in patch) {
    if (patch.status != null && !["arrived", "done", "skipped"].includes(patch.status)) return { ok: false, error: "잘못된 상태예요." };
    row.status = patch.status ?? null;
  }
  if (patch.checkIndex != null) {
    if (!Number.isInteger(patch.checkIndex) || patch.checkIndex < 0 || patch.checkIndex > 50) return { ok: false, error: "잘못된 체크 항목이에요." };
    row.checks = { ...row.checks, [String(patch.checkIndex)]: !!patch.checked };
  }
  if ("memo" in patch) {
    if ((patch.memo ?? "").length > 2000) return { ok: false, error: "메모는 2000자까지 쓸 수 있어요." };
    row.memo = patch.memo ?? "";
  }
  if ("cost" in patch) {
    if (patch.cost != null && !(Number.isInteger(patch.cost) && patch.cost >= 0 && patch.cost <= 100_000_000)) {
      return { ok: false, error: "지출은 0 이상의 정수로 입력해주세요." };
    }
    row.cost = patch.cost ?? null;
  }

  const { error } = await supabase.from("trip_progress").upsert(row, { onConflict: "trip_id,item_id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/* ---------- 일정 편집 ---------- */

export type DayOp =
  | { type: "toggle"; itemId: string }
  | { type: "move"; index: number; dir: 1 | -1 }
  | { type: "dur"; itemId: string; delta: number }
  | { type: "add"; placeId: string }
  | { type: "addRest"; title: string }
  | { type: "remove"; itemId: string }
  | { type: "reset" };

export async function editDay(tripId: string, planId: string, day: number, op: DayOp): Promise<Result> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  const { supabase, user } = c;

  const trip = await loadTrip(supabase, tripId);
  if (!trip) return { ok: false, error: "여행을 찾을 수 없어요." };
  const def = trip.def;
  if (!def.plans[planId] || !def.days.some((d) => d.n === day)) return { ok: false, error: "잘못된 일정이에요." };
  const mandatory = def.mandatory ?? [];

  if (op.type === "reset") {
    const { error } = await supabase.from("trip_day_items").delete().eq("trip_id", tripId).eq("plan_id", planId).eq("day", day);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/trips/${tripId}`);
    return { ok: true };
  }

  const { ov } = await loadTripState(supabase, tripId);
  let items: PlanItem[] = structuredClone(dayItems(def, ov, planId, day));

  switch (op.type) {
    case "toggle": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      it.included = it.included === false;
      break;
    }
    case "move": {
      const r = move(items, op.index, op.dir, mandatory);
      if (!r.ok) return { ok: false, error: r.reason };
      items = r.items;
      break;
    }
    case "dur": {
      const it = items.find((i) => i.id === op.itemId);
      if (!it) return { ok: false, error: "항목을 찾을 수 없어요." };
      const base = it.dur ?? (it.p ? def.places.find((p) => p.id === it.p)?.dur : undefined) ?? 30;
      it.dur = Math.min(600, Math.max(5, base + Math.trunc(op.delta)));
      break;
    }
    case "add": {
      if (!def.places.some((p) => p.id === op.placeId)) return { ok: false, error: "알 수 없는 장소예요." };
      if (items.length >= 60) return { ok: false, error: "하루에 넣을 수 있는 항목이 가득 찼어요." };
      items.push({ id: uid("it"), p: op.placeId });
      break;
    }
    case "addRest": {
      const title = op.title.trim().slice(0, 60);
      if (!title) return { ok: false, error: "일정 이름을 입력해주세요." };
      items.push({ id: uid("it"), rest: title, dur: 30 });
      break;
    }
    case "remove": {
      const it = items.find((i) => i.id === op.itemId);
      if (it?.p && mandatory.includes(it.p)) return { ok: false, error: "필수 방문지는 삭제할 수 없어요. 제외로 바꿔주세요." };
      items = items.filter((i) => i.id !== op.itemId);
      break;
    }
  }

  const { error } = await supabase
    .from("trip_day_items")
    .upsert({ trip_id: tripId, plan_id: planId, day, items, updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "trip_id,plan_id,day" });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/* ---------- 내 장소 ---------- */

export async function addPlace(
  tripId: string,
  input: { name: string; cat: string; addr: string; lat: string; lon: string; dur: string; hours: string; desc: string; note: string; planId: string; day: number; addNow: boolean },
): Promise<Result> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  const { supabase } = c;

  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "이름은 필수예요." };
  const hasLat = input.lat.trim() !== "";
  const hasLon = input.lon.trim() !== "";
  if (hasLat !== hasLon) return { ok: false, error: "위도와 경도를 함께 입력하거나 둘 다 비워주세요." };
  const lat = hasLat ? Number(input.lat) : undefined;
  const lon = hasLon ? Number(input.lon) : undefined;
  if (hasLat && !validCoord(lat, lon)) return { ok: false, error: "좌표가 올바르지 않아요 (위도 -90~90, 경도 -180~180)." };
  const dur = Number(input.dur);
  if (!(dur >= 5 && dur <= 600)) return { ok: false, error: "체류시간은 5~600분으로 입력해주세요." };

  const trip = await loadTrip(supabase, tripId);
  if (!trip) return { ok: false, error: "여행을 찾을 수 없어요." };
  if (trip.def.places.length >= 300) return { ok: false, error: "장소는 최대 300개까지 추가할 수 있어요." };

  const place: Place = {
    id: uid("u"), name, cat: input.cat in { sight: 1, food: 1, activity: 1, show: 1, parking: 1, stay: 1, etc: 1 } ? input.cat : "etc",
    dur, addr: input.addr.trim().slice(0, 200) || undefined, hours: input.hours.trim().slice(0, 100) || undefined,
    desc: input.desc.trim().slice(0, 300) || undefined, note: input.note.trim().slice(0, 500) || undefined,
    ...(lat != null && lon != null ? { lat, lon } : {}),
  };
  const def: TripDef = { ...trip.def, places: [...trip.def.places, place] };
  const { error } = await supabase.from("trips").update({ def, updated_at: new Date().toISOString() }).eq("id", tripId);
  if (error) return { ok: false, error: error.message };

  if (input.addNow) {
    const r = await editDay(tripId, input.planId, input.day, { type: "add", placeId: place.id });
    if (!r.ok) return r;
  }
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
