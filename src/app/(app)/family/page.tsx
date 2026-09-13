import { createClient } from "@/lib/supabase/server";
import { categoryMeta } from "@/lib/categories";
import { toggleReaction } from "@/app/actions";

const REACTION_EMOJIS = ["🔥", "🌱", "🔍", "💛", "😄"];

export default async function FamilyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from("diary_entries")
    .select("id, category, content, entry_date, user_id, profiles(name), reactions(id, emoji, user_id)")
    .eq("visibility", "family")
    .is("deleted_at", null)
    .order("entry_date", { ascending: false })
    .limit(30);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-lg font-semibold">가족 피드</h1>

      {!entries?.length ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400">
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
              <li key={entry.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
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
                            mine ? "border-amber-400 bg-amber-50" : "border-neutral-200 text-neutral-500"
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
