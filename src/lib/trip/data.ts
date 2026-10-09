import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanItem, ProgressRow, TripDef } from "./types";

export type TripRow = { id: string; family_id: string; created_by: string; title: string; def: TripDef; start_date: string | null };

// RLS가 가족 범위를 이미 좁혀주므로 family_id/user_id 필터를 걸지 않는다.
export async function loadTrip(supabase: SupabaseClient, tripId: string): Promise<TripRow | null> {
  const { data } = await supabase
    .from("trips")
    .select("id, family_id, created_by, title, def, start_date")
    .eq("id", tripId)
    .maybeSingle();
  return (data as TripRow | null) ?? null;
}

export async function loadTripState(supabase: SupabaseClient, tripId: string) {
  const [{ data: overrides }, { data: progress }] = await Promise.all([
    supabase.from("trip_day_items").select("plan_id, day, items").eq("trip_id", tripId),
    supabase.from("trip_progress").select("item_id, status, checks, memo, cost, updated_at").eq("trip_id", tripId),
  ]);
  const ov = new Map<string, PlanItem[]>();
  for (const o of overrides ?? []) ov.set(`${o.plan_id}:${o.day}`, o.items as PlanItem[]);
  const prog = new Map<string, ProgressRow>();
  for (const p of (progress ?? []) as ProgressRow[]) prog.set(p.item_id, p);
  return { ov, prog };
}

// 편집본이 있으면 그것을, 없으면 기본 일정을 쓴다.
export function dayItems(def: TripDef, ov: Map<string, PlanItem[]>, planId: string, day: number): PlanItem[] {
  return ov.get(`${planId}:${day}`) ?? def.plans[planId]?.days[String(day)] ?? [];
}

export function allDays(def: TripDef, ov: Map<string, PlanItem[]>, planId: string): Record<string, PlanItem[]> {
  const out: Record<string, PlanItem[]> = {};
  for (const d of def.days) out[String(d.n)] = dayItems(def, ov, planId, d.n);
  return out;
}
