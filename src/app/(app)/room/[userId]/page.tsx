import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getItemStats } from "@/lib/get-item-stats";
import { ITEMS } from "@/lib/items";
import { WorldView } from "@/components/world-view";

const WORLD_LABEL: Record<string, string> = { tree: "나무", constellation: "별자리", planet: "행성" };

export default async function RoomPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Independent of each other, so don't pay three sequential round trips.
  const [{ data: profile }, stats, { data: goals }] = await Promise.all([
    supabase.from("profiles").select("name, world_type").eq("id", userId).maybeSingle(),
    getItemStats(supabase, userId),
    supabase.from("goals").select("id, title, achieved_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!profile) notFound();

  const isMe = user!.id === userId;
  const unlockedItems = ITEMS.filter((item) => item.isUnlocked(stats));

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-lg font-semibold">{profile.name}님의 공간</h1>
        <p className="mt-1 text-xs text-neutral-400">
          {WORLD_LABEL[profile.world_type] ?? "나무"} 세계관
          {isMe && (
            <>
              {" · "}
              <Link href="/settings" className="underline">
                바꾸기
              </Link>
            </>
          )}
        </p>
      </div>

      <WorldView worldType={profile.world_type} itemCount={unlockedItems.length} />

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">🎁 모은 아이템 ({unlockedItems.length})</h2>
        {!unlockedItems.length ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-400">
            아직 모은 아이템이 없어요.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {unlockedItems.map((item) => (
              <li
                key={item.id}
                className="flex flex-col items-center gap-1 rounded-2xl border border-accent-200 bg-accent-50 px-3 py-2.5"
              >
                <span className="text-2xl">{item.emoji}</span>
                <span className="whitespace-nowrap text-[11px] text-accent-700">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!!goals?.length && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-neutral-500">🎯 목표</h2>
          <ul className="flex flex-col gap-1.5">
            {goals.map((goal) => (
              <li
                key={goal.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  goal.achieved_at ? "bg-accent-50 text-neutral-400 line-through" : "bg-card border border-line"
                }`}
              >
                {goal.achieved_at ? "✅ " : "⬜️ "}
                {goal.title}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
