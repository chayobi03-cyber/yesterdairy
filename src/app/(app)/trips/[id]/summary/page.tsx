import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { loadSnapshot } from "@/lib/trip/data";
import { SummaryView } from "./summary-view";

export default async function TripSummaryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ plan?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const loaded = await loadSnapshot(await createClient(), id);
  if (!loaded) notFound();
  const { trip, snapshot } = loaded;
  const planIds = Object.keys(trip.def.plans);
  const plan = sp.plan && trip.def.plans[sp.plan] ? sp.plan : trip.def.defaultPlan && trip.def.plans[trip.def.defaultPlan] ? trip.def.defaultPlan : planIds[0];

  return <SummaryView initial={snapshot} plan={plan} isCreator={trip.created_by === user.id} userId={user.id} />;
}
