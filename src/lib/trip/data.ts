import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_PHOTOS_PER_TRIP } from "./photos";
import type { TripSnapshot } from "./view-model";
import { MAX_COMMENTS_PER_TRIP } from "./comments";
import type { PlanItem, ProgressRow, TripComment, TripDef, TripPhoto } from "./types";

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
    supabase.from("trip_progress").select("item_id, status, checks, memo, cost, review, rating, updated_at, profiles(name)").eq("trip_id", tripId),
  ]);
  const ov = new Map<string, PlanItem[]>();
  for (const o of overrides ?? []) ov.set(`${o.plan_id}:${o.day}`, o.items as PlanItem[]);
  const prog = new Map<string, ProgressRow>();
  for (const p of (progress ?? []) as unknown as (ProgressRow & { profiles?: { name: string } | null })[]) {
    const { profiles, ...row } = p;
    prog.set(p.item_id, { ...row, authorName: profiles?.name ?? null });
  }
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

export const PHOTO_URL_TTL = 6 * 60 * 60; // 서명 URL 유효시간(초)

// 사진 목록 + 서명 URL (RLS가 가족 범위로 좁혀준다)
export async function loadTripPhotos(supabase: SupabaseClient, tripId: string): Promise<TripPhoto[]> {
  const { data } = await supabase
    .from("trip_photos")
    .select("id, item_id, path, thumb_path, created_by, created_at, profiles(name)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })
    .limit(MAX_PHOTOS_PER_TRIP);
  const rows = data ?? [];
  if (!rows.length) return [];
  const paths = rows.flatMap((r) => [r.path as string, r.thumb_path as string]);
  const { data: signed } = await supabase.storage.from("trip-media").createSignedUrls(paths, PHOTO_URL_TTL);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows
    .map((r) => ({
      id: r.id as string,
      itemId: (r.item_id as string | null) ?? null,
      createdBy: r.created_by as string,
      authorName: ((r.profiles as unknown as { name: string } | null)?.name) ?? "가족",
      createdAt: r.created_at as string,
      url: urlByPath.get(r.path as string) ?? "",
      thumbUrl: urlByPath.get(r.thumb_path as string) ?? "",
    }))
    .filter((p) => p.url && p.thumbUrl);
}

export async function loadTripComments(supabase: SupabaseClient, tripId: string): Promise<TripComment[]> {
  const { data } = await supabase
    .from("trip_comments")
    .select("id, item_id, body, created_by, created_at, profiles(name)")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true })
    .limit(MAX_COMMENTS_PER_TRIP);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    itemId: r.item_id as string,
    body: r.body as string,
    createdBy: r.created_by as string,
    authorName: ((r.profiles as unknown as { name: string } | null)?.name) ?? "가족",
    createdAt: r.created_at as string,
  }));
}

// 여행 화면/요약 화면이 함께 쓰는 스냅샷 로더. 다른 가족의 여행은 RLS 때문에 조회되지 않아 null.
export async function loadSnapshot(supabase: SupabaseClient, tripId: string): Promise<{ trip: TripRow; snapshot: TripSnapshot } | null> {
  const trip = await loadTrip(supabase, tripId);
  if (!trip) return null;
  const [{ ov, prog }, photos, comments] = await Promise.all([loadTripState(supabase, tripId), loadTripPhotos(supabase, tripId), loadTripComments(supabase, tripId)]);
  return {
    trip,
    snapshot: {
      tripId,
      title: trip.title,
      startDate: trip.start_date,
      def: trip.def,
      overrides: Object.fromEntries(ov),
      progress: Object.fromEntries(prog),
      photos,
      comments,
    },
  };
}
