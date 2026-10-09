import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { loadTrip, loadTripState } from "@/lib/trip/data";
import type { TripSnapshot } from "@/lib/trip/view-model";
import { TripView } from "./trip-view";

type SP = { plan?: string; day?: string };

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  // RLS가 가족 범위로 좁혀준다: 다른 가족의 여행은 조회되지 않아 404
  const trip = await loadTrip(supabase, id);
  if (!trip) notFound();
  const { ov, prog } = await loadTripState(supabase, id);
  const def = trip.def;

  const planIds = Object.keys(def.plans);
  const initialPlan = sp.plan && def.plans[sp.plan] ? sp.plan : def.defaultPlan && def.plans[def.defaultPlan] ? def.defaultPlan : planIds[0];
  const initialDay = def.days.some((d) => String(d.n) === sp.day) ? Number(sp.day) : def.days[0].n;

  const initial: TripSnapshot = {
    tripId: id,
    title: trip.title,
    startDate: trip.start_date,
    def,
    overrides: Object.fromEntries(ov),
    progress: Object.fromEntries(prog),
  };

  return <TripView initial={initial} isCreator={trip.created_by === user.id} initialPlan={initialPlan} initialDay={initialDay} />;
}
