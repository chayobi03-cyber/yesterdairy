import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { computeStreak } from "@/lib/streak";
import { daysUntilNextStage } from "@/lib/pet";
import { getTodayISO } from "@/lib/today";
import { PetView } from "@/components/pet-view";

export default async function ChallengePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [{ data: entries }, today] = await Promise.all([
    supabase.from("diary_entries").select("entry_date").eq("user_id", user.id).is("deleted_at", null),
    getTodayISO(),
  ]);

  const streak = computeStreak((entries ?? []).map((e) => e.entry_date), today);
  const toNext = daysUntilNextStage(streak);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">도전 모드</h1>
        <p className="mt-1 text-xs text-neutral-400">매일 기록하면 나만의 동물이 자라나요</p>
      </div>

      <PetView streak={streak} />

      <p className="text-center text-sm text-neutral-500">
        {streak === 0
          ? "오늘 기록을 남기면 알에서 깨어나요."
          : toNext
            ? `${toNext}일 더 연속으로 기록하면 다음 단계예요.`
            : "가장 반짝이는 단계에 도달했어요!"}
      </p>
    </div>
  );
}
