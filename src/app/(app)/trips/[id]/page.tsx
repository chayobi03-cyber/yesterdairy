import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getTodayISO } from "@/lib/today";
import { dayForDate } from "@/lib/trip/comments";
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
  // ?day가 없으면 "오늘"(뷰어의 로컬 날짜)에 해당하는 날을 먼저 연다. 여행 전이면 1일차, 끝났으면 마지막 날.
  const supabase = await createClient();
  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const todayDay = dayForDate(trip.start_date, await getTodayISO(), def.days.length);
  const initialDay = def.days.some((d) => String(d.n) === sp.day) ? Number(sp.day) : (def.days[todayDay - 1]?.n ?? def.days[0].n);

  return <TripView initial={snapshot} isCreator={trip.created_by === user.id} userId={user.id} userName={me?.name ?? "나"} initialPlan={initialPlan} initialDay={initialDay} />;
}
