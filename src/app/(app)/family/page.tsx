import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoryMeta } from "@/lib/categories";
import { toggleReaction, toggleGoalAchieved, toggleCheer } from "@/app/actions";
import { GoalForm } from "./goal-form";

const REACTION_EMOJIS = ["🔥", "🌱", "🔍", "💛", "😄"];

type Goal = {
  id: string;
  title: string;
  target_date: string | null;
  achieved_at: string | null;
  user_id: string;
  profiles: { name: string } | null;
  goal_cheers: { id: string; user_id: string }[];
};

export default async function FamilyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // membership, entries and goals are all independent of each other —
  // only "members" needs membership.family_id, so that one waits its turn.
  const [{ data: membership }, { data: entries }, { data: myGoals }, { data: familyGoals }] = await Promise.all([
    supabase.from("family_members").select("family_id, families(name, invite_code)").eq("user_id", user!.id).maybeSingle(),
    supabase
      .from("diary_entries")
      .select("id, category, content, entry_date, user_id, profiles(name), reactions(id, emoji, user_id)")
      .eq("visibility", "family")
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(30),
    supabase
      .from("goals")
      .select("id, title, target_date, achieved_at, user_id, profiles(name), goal_cheers(id, user_id)")
      .eq("user_id", user!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("goals")
      .select("id, title, target_date, achieved_at, user_id, profiles(name), goal_cheers(id, user_id)")
      .eq("visibility", "family")
      .neq("user_id", user!.id)
      .order("created_at", { ascending: false }),
  ]);

  const family = membership?.families as unknown as { name: string; invite_code: string } | null;

  const { data: members } = membership
    ? await supabase
        .from("family_members")
        .select("user_id, role, profiles(name)")
        .eq("family_id", membership.family_id)
    : { data: null };

  const goals = [...(myGoals ?? []), ...(familyGoals ?? [])] as unknown as Goal[];

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <h1 className="text-lg font-semibold">{family?.name ?? "가족"} 피드</h1>
        {family && (
          <p className="mt-1 text-xs text-neutral-400">
            초대 코드: <span className="font-mono tracking-widest text-neutral-600">{family.invite_code}</span> — 다른 가족에게 알려주세요
          </p>
        )}
      </div>

      {!!members?.length && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => {
            const name = (m.profiles as unknown as { name: string } | null)?.name ?? "?";
            return (
              <Link
                key={m.user_id}
                href={`/room/${m.user_id}`}
                className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600"
              >
                {name} · {m.role === "parent" ? "부모" : "아이"}
              </Link>
            );
          })}
        </div>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-neutral-500">🎯 가족 목표</h2>

        {!!goals.length && (
          <ul className="flex flex-col gap-2">
            {goals.map((goal) => {
              const isMine = goal.user_id === user!.id;
              const achieved = !!goal.achieved_at;
              const iCheered = goal.goal_cheers.some((c) => c.user_id === user!.id);

              return (
                <li
                  key={goal.id}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 ${
                    achieved ? "border-accent-200 bg-accent-50" : "border-line bg-card"
                  }`}
                >
                  {isMine ? (
                    <form action={toggleGoalAchieved.bind(null, goal.id, achieved)}>
                      <button type="submit" className="text-lg" aria-label="달성 체크">
                        {achieved ? "✅" : "⬜️"}
                      </button>
                    </form>
                  ) : (
                    <span className="text-lg">{achieved ? "✅" : "⬜️"}</span>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${achieved ? "text-neutral-400 line-through" : "text-neutral-700"}`}>
                      {goal.title}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {isMine ? "나" : (goal.profiles?.name ?? "가족")}
                      {goal.target_date ? ` · ~${goal.target_date}` : ""}
                    </p>
                  </div>

                  {!isMine && (
                    <form action={toggleCheer.bind(null, goal.id)}>
                      <button
                        type="submit"
                        className={`shrink-0 rounded-full border px-2.5 py-1 text-xs ${
                          iCheered ? "border-accent-400 bg-accent-50" : "border-line text-neutral-500"
                        }`}
                      >
                        👏 {goal.goal_cheers.length > 0 ? goal.goal_cheers.length : ""}
                      </button>
                    </form>
                  )}
                  {isMine && goal.goal_cheers.length > 0 && (
                    <span className="shrink-0 text-xs text-accent-600">👏 {goal.goal_cheers.length}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <GoalForm />
      </section>

      <h2 className="text-sm font-medium text-neutral-500">📝 가족 기록</h2>

      {!entries?.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-400">
          아직 가족에게 공개된 기록이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => {
            const meta = categoryMeta(entry.category);
            const authorName = (entry.profiles as unknown as { name: string } | null)?.name ?? "가족";
            const reactionCounts = new Map<string, number>();
            const myReactions = new Set<string>();
            for (const r of entry.reactions ?? []) {
              reactionCounts.set(r.emoji, (reactionCounts.get(r.emoji) ?? 0) + 1);
              if (r.user_id === user!.id) myReactions.add(r.emoji);
            }

            return (
              <li key={entry.id} className="rounded-2xl border border-line bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm">
                  <span>{meta.emoji}</span>
                  <span className="font-medium">{authorName}</span>
                  <span className="ml-auto text-xs text-neutral-400">{entry.entry_date}</span>
                </div>
                <p className="mt-1 text-sm text-neutral-700">{entry.content}</p>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {REACTION_EMOJIS.map((emoji) => {
                    const count = reactionCounts.get(emoji) ?? 0;
                    const mine = myReactions.has(emoji);
                    return (
                      <form key={emoji} action={toggleReaction.bind(null, entry.id, emoji)}>
                        <button
                          type="submit"
                          className={`rounded-full border px-2.5 py-1 text-xs ${
                            mine ? "border-accent-400 bg-accent-50" : "border-line text-neutral-500"
                          }`}
                        >
                          {emoji} {count > 0 ? count : ""}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
