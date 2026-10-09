import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { loadSnapshot } from "@/lib/trip/data";
import { TripView } from "./trip-view";

type SP = { plan?: string; day?: string };

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // RLS가 가족 범위로 좁혀준다: 다른 가족의 여행은 조회되지 않아 404
  const loaded = await loadSnapshot(await createClient(), id);
  if (!loaded) notFound();
  const { trip, snapshot } = loaded;
  const def = trip.def;

  const planIds = Object.keys(def.plans);
  const initialPlan = sp.plan && def.plans[sp.plan] ? sp.plan : def.defaultPlan && def.plans[def.defaultPlan] ? def.defaultPlan : planIds[0];
  const initialDay = def.days.some((d) => String(d.n) === sp.day) ? Number(sp.day) : def.days[0].n;

  return <TripView initial={snapshot} isCreator={trip.created_by === user.id} userId={user.id} initialPlan={initialPlan} initialDay={initialDay} />;
}
