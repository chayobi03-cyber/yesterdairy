import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoryMeta } from "@/lib/categories";
import { ITEMS, type ItemStats } from "@/lib/items";

function todayISO() {
  return new Date().toLocaleDateString("sv-SE"); // yyyy-mm-dd, local time
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user!.id)
    .single();

  const today = todayISO();
  const { data: todayEntries } = await supabase
    .from("diary_entries")
    .select("id, category, content, visibility, created_at")
    .eq("user_id", user!.id)
    .eq("entry_date", today)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: allEntries } = await supabase
    .from("diary_entries")
    .select("category, entry_date")
    .eq("user_id", user!.id)
    .is("deleted_at", null);

  const categoryCounts: Record<string, number> = {};
  const entryDays = new Set<string>();
  for (const e of allEntries ?? []) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;
    entryDays.add(e.entry_date);
  }

  const { data: myGoals } = await supabase.from("goals").select("id, achieved_at").eq("user_id", user!.id);
  const achievedGoals = (myGoals ?? []).filter((g) => g.achieved_at).length;
  const myGoalIds = (myGoals ?? []).map((g) => g.id);

  let cheersReceived = 0;
  if (myGoalIds.length) {
    const { count } = await supabase
      .from("goal_cheers")
      .select("id", { count: "exact", head: true })
      .in("goal_id", myGoalIds);
    cheersReceived = count ?? 0;
  }

  const stats: ItemStats = { categoryCounts, achievedGoals, cheersReceived, entryDays: entryDays.size };
  const unlockedItems = ITEMS.filter((item) => item.isUnlocked(stats));

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <p className="text-sm text-neutral-500">
          {new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" })}
        </p>
        <h1 className="mt-1 text-xl font-semibold">
          {profile?.name ?? "안녕"}, 오늘 기억나는 순간 하나만 골라볼래?
        </h1>
      </div>

      <Link
        href="/write"
        className="flex items-center justify-center gap-2 rounded-3xl bg-accent-400 px-6 py-4 text-sm font-medium text-white shadow-sm shadow-accent-200/60 transition active:scale-[0.98]"
      >
        ✏️ 오늘의 순간 기록하기
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">오늘의 기록</h2>
        {!todayEntries?.length ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-400">
            아직 오늘 기록이 없어요. 지금 적어도 그날의 기록이에요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todayEntries.map((entry) => {
              const meta = categoryMeta(entry.category);
              return (
                <li key={entry.id} className="rounded-2xl border border-line bg-card px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{meta.emoji}</span>
                    <span className="font-medium">{meta.label}</span>
                    {entry.visibility === "family" && (
                      <span className="ml-auto rounded-full bg-accent-50 px-2 py-0.5 text-[11px] text-accent-600">
                        가족 공개
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">{entry.content}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">🎁 모은 아이템</h2>
        {!unlockedItems.length ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-400">
            아직 모은 아이템이 없어요. 기록하고 목표를 응원받으면 하나씩 늘어나요.
          </p>
        ) : (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {unlockedItems.map((item) => (
              <li
                key={item.id}
                className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-accent-200 bg-accent-50 px-3 py-2.5"
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="whitespace-nowrap text-[11px] text-accent-700">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
