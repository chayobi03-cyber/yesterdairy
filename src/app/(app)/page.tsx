import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { categoryMeta } from "@/lib/categories";
import { ITEMS } from "@/lib/items";
import { getItemStats } from "@/lib/get-item-stats";
import { getTodayISO } from "@/lib/today";
import { todayMission } from "@/lib/color-names";

function isoDaysAgo(todayISO: string, days: number): string {
  const d = new Date(`${todayISO}T12:00:00`);
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("sv-SE");
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const today = await getTodayISO();
  const weekAgo = isoDaysAgo(today, 6);

  // None of these depend on each other — run them concurrently instead of
  // paying for round trip after round trip.
  const [{ data: profile }, { data: todayEntries }, stats, { data: recentColors }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user.id).single(),
    supabase
      .from("diary_entries")
      .select("id, category, content, visibility, created_at")
      .eq("user_id", user.id)
      .eq("entry_date", today)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    getItemStats(supabase, user.id),
    // No .eq("user_id", ...) -- RLS already scopes daily_colors to the
    // caller's own rows (it has no family-read policy at all).
    supabase
      .from("daily_colors")
      .select("color_date, hex, name, mission_hex, mission_name, match_percent")
      .gte("color_date", weekAgo)
      .lte("color_date", today),
  ]);

  const unlockedItems = ITEMS.filter((item) => item.isUnlocked(stats));
  const colorByDate = new Map((recentColors ?? []).map((c) => [c.color_date, c]));
  const last7Days = Array.from({ length: 7 }, (_, i) => isoDaysAgo(today, 6 - i));
  const todayColor = colorByDate.get(today) ?? null;
  const mission = todayMission(today);

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
        href="/colors/capture"
        className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4"
      >
        {todayColor ? (
          <span
            className="h-11 w-11 shrink-0 rounded-full border border-line"
            style={{ background: todayColor.hex }}
          />
        ) : (
          <span
            className="h-11 w-11 shrink-0 rounded-full border border-line"
            style={{ background: mission.hex }}
          />
        )}
        <span className="flex-1">
          <span className="block text-sm font-medium">
            {todayColor ? `오늘의 색 · ${todayColor.name}` : `오늘의 미션 · ${mission.name}`}
          </span>
          <span className="block text-xs text-neutral-400">
            {todayColor
              ? typeof todayColor.match_percent === "number"
                ? `미션과 ${todayColor.match_percent}% 일치 · 다시 채집하려면 탭하세요`
                : "다시 채집하려면 탭하세요"
              : "이 색을 찾아서 채집하러 가볼까요?"}
          </span>
        </span>
      </Link>

      {colorByDate.size > 0 && (
        <div className="flex items-center justify-between px-1">
          {last7Days.map((iso) => {
            const c = colorByDate.get(iso);
            return (
              <span
                key={iso}
                title={c ? `${c.name} · ${c.hex}` : iso}
                className={`h-3 w-3 rounded-full ${c ? "" : "border border-dashed border-line"}`}
                style={c ? { background: c.hex } : undefined}
              />
            );
          })}
        </div>
      )}

      <Link href="/colors" className="text-center text-xs text-accent-600 underline">
        🎨 색 컬렉션 보러가기
      </Link>

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
                      <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] text-accent-600">
                        가족 공개
                      </span>
                    )}
                    <Link href={`/write/${entry.id}`} className="ml-auto text-xs text-neutral-400 underline underline-offset-2">
                      수정
                    </Link>
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">{entry.content}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-500">🎁 모은 아이템</h2>
          <div className="flex items-center gap-2 text-xs text-accent-600">
            <Link href="/challenge" className="underline">
              🐣 도전 모드
            </Link>
            <span className="text-accent-200">·</span>
            <Link href={`/room/${user.id}`} className="underline">
              내 공간 보러가기
            </Link>
          </div>
        </div>
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
