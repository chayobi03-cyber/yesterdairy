"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { loadTrip } from "@/lib/trip/data";
import { CONFLICT_MESSAGE, MAX_CAS_ATTEMPTS, nextVersion } from "@/lib/trip/cas";
import { applyDayOp, buildPlace, MAX_PLACES, type DayOp, type NewPlaceInput } from "@/lib/trip/day-ops";
import { validateTrip } from "@/lib/trip/engine";
import { applyProgressPatch, EMPTY_PROGRESS, type ProgressPatch, type ProgressState } from "@/lib/trip/progress";
import { jeonjuTemplate } from "@/lib/trip/templates/jeonju";
import type { PlanItem, TripDef } from "@/lib/trip/types";

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

/* ---------- 동시 편집 (낙관적 잠금) ----------
 * 읽은 updated_at과 같을 때만 저장하고, 다르면(다른 가족이 먼저 저장) 최신 데이터를
 * 다시 읽어 같은 변경을 다시 적용한다. 그래서 두 사람이 동시에 서로 다른 항목을
 * 고쳐도 둘 다 반영된다. */

const UNIQUE_VIOLATION = "23505";

/* ---------- 장소별 진행 기록 ---------- */

export async function updateProgress(tripId: string, itemId: string, patch: ProgressPatch): Promise<Result> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  if (!ID_RE.test(itemId)) return { ok: false, error: "잘못된 항목이에요." };
  const { supabase, user } = c;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const { data: existing, error: readError } = await supabase
      .from("trip_progress")
      .select("status, checks, memo, cost, updated_at")
      .eq("trip_id", tripId)
      .eq("item_id", itemId)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };

    const cur: ProgressState = existing
      ? { status: existing.status, checks: existing.checks ?? {}, memo: existing.memo ?? "", cost: existing.cost }
      : EMPTY_PROGRESS;
    const next = applyProgressPatch(cur, patch);
    if (!next.ok) return next;

    const values = { ...next.state, updated_by: user.id, updated_at: nextVersion(existing?.updated_at, Date.now()) };

    if (existing) {
      const { data: updated, error } = await supabase
        .from("trip_progress")
        .update(values)
        .eq("trip_id", tripId)
        .eq("item_id", itemId)
        .eq("updated_at", existing.updated_at)
        .select("item_id");
      if (error) return { ok: false, error: error.message };
      if (updated?.length) break; // 성공
    } else {
      const { error } = await supabase.from("trip_progress").insert({ trip_id: tripId, item_id: itemId, ...values });
      if (!error) break;
      if (error.code !== UNIQUE_VIOLATION) return { ok: false, error: error.message };
    }
    if (attempt === MAX_CAS_ATTEMPTS - 1) return { ok: false, error: CONFLICT_MESSAGE };
  }

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/* ---------- 일정 편집 ---------- */

export type { DayOp } from "@/lib/trip/day-ops";

export async function editDay(tripId: string, planId: string, day: number, op: DayOp | { type: "reset" }): Promise<Result> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  const { supabase, user } = c;

  const trip = await loadTrip(supabase, tripId);
  if (!trip) return { ok: false, error: "여행을 찾을 수 없어요." };
  const def = trip.def;
  if (!def.plans[planId] || !def.days.some((d) => d.n === day)) return { ok: false, error: "잘못된 일정이에요." };

  if (op.type === "reset") {
    const { error } = await supabase.from("trip_day_items").delete().eq("trip_id", tripId).eq("plan_id", planId).eq("day", day);
    if (error) return { ok: false, error: error.message };
    revalidatePath(`/trips/${tripId}`);
    return { ok: true };
  }

  const opCtx = { places: def.places, mandatory: def.mandatory ?? [] };

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const { data: existing, error: readError } = await supabase
      .from("trip_day_items")
      .select("items, updated_at")
      .eq("trip_id", tripId)
      .eq("plan_id", planId)
      .eq("day", day)
      .maybeSingle();
    if (readError) return { ok: false, error: readError.message };

    // 편집본이 없으면 기본 일정을 출발점으로 쓴다
    const base: PlanItem[] = existing ? (existing.items as PlanItem[]) : (def.plans[planId].days[String(day)] ?? []);
    const next = applyDayOp(base, op, opCtx);
    if (!next.ok) return next;

    const values = { items: next.items, updated_by: user.id, updated_at: nextVersion(existing?.updated_at, Date.now()) };

    if (existing) {
      const { data: updated, error } = await supabase
        .from("trip_day_items")
        .update(values)
        .eq("trip_id", tripId)
        .eq("plan_id", planId)
        .eq("day", day)
        .eq("updated_at", existing.updated_at)
        .select("day");
      if (error) return { ok: false, error: error.message };
      if (updated?.length) break;
    } else {
      const { error } = await supabase.from("trip_day_items").insert({ trip_id: tripId, plan_id: planId, day, ...values });
      if (!error) break;
      if (error.code !== UNIQUE_VIOLATION) return { ok: false, error: error.message };
    }
    if (attempt === MAX_CAS_ATTEMPTS - 1) return { ok: false, error: CONFLICT_MESSAGE };
  }

  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}

/* ---------- 내 장소 ---------- */

export async function addPlace(tripId: string, input: NewPlaceInput & { planId: string; day: number; addNow: boolean }): Promise<Result> {
  const c = await ctx();
  if (!c) return NOT_SIGNED_IN;
  const { supabase } = c;

  const built = buildPlace(input);
  if (!built.ok) return built;

  for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt++) {
    const { data: row, error: readError } = await supabase.from("trips").select("def, updated_at").eq("id", tripId).maybeSingle();
    if (readError) return { ok: false, error: readError.message };
    if (!row) return { ok: false, error: "여행을 찾을 수 없어요." };

    const def = row.def as TripDef;
    if (def.places.length >= MAX_PLACES) return { ok: false, error: `장소는 최대 ${MAX_PLACES}개까지 추가할 수 있어요.` };

    const { data: updated, error } = await supabase
      .from("trips")
      .update({ def: { ...def, places: [...def.places, built.place] }, updated_at: nextVersion(row.updated_at, Date.now()) })
      .eq("id", tripId)
      .eq("updated_at", row.updated_at)
      .select("id");
    if (error) return { ok: false, error: error.message };
    if (updated?.length) break;
    if (attempt === MAX_CAS_ATTEMPTS - 1) return { ok: false, error: CONFLICT_MESSAGE };
  }

  if (input.addNow) {
    const r = await editDay(tripId, input.planId, input.day, { type: "add", placeId: built.place.id });
    if (!r.ok) return { ok: false, error: `장소는 저장했지만 일정에 넣지 못했어요: ${r.error}` };
  }
  revalidatePath(`/trips/${tripId}`);
  return { ok: true };
}
