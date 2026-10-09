import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { CreateTripForm } from "./create-trip-form";

export default async function TripsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  // RLS가 우리 가족의 여행만 돌려준다.
  const { data: trips } = await supabase
    .from("trips")
    .select("id, title, start_date, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Link href="/" className="text-sm text-neutral-400">
        ‹ 홈으로
      </Link>
      <h1 className="text-lg font-semibold">🧳 가족 여행</h1>
      <p className="text-xs text-neutral-400">
        가족이 함께 보고 고치는 여행 계획이에요. 장소별로 도착·완료를 기록하면 가족 모두에게 보여요.
      </p>

      <CreateTripForm />

      {trips?.length ? (
        <ul className="flex flex-col gap-2">
          {trips.map((t) => (
            <li key={t.id}>
              <Link href={`/trips/${t.id}`} className="block rounded-2xl border border-line bg-card p-4">
                <span className="block text-sm font-medium">{t.title}</span>
                <span className="block text-xs text-neutral-400">
                  {t.start_date ? `${t.start_date} 출발` : "출발일 미정"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-neutral-400">아직 여행이 없어요. 위에서 하나 만들어볼까요?</p>
      )}
    </div>
  );
}
