import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemStats } from "@/lib/items";

// Works for any target user, including someone other than the caller.
// No extra privacy logic needed here: RLS already scopes what comes back —
// the caller's own rows regardless of visibility, another family member's
// only if they're visibility='family'. So a stranger's room (or a private
// entry) never leaks through this.
export async function getItemStats(supabase: SupabaseClient, targetUserId: string): Promise<ItemStats> {
  const { data: entries } = await supabase
    .from("diary_entries")
    .select("category, entry_date")
    .eq("user_id", targetUserId)
    .is("deleted_at", null);

  const categoryCounts: Record<string, number> = {};
  const entryDays = new Set<string>();
  for (const e of entries ?? []) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;
    entryDays.add(e.entry_date);
  }

  const { data: goals } = await supabase.from("goals").select("id, achieved_at").eq("user_id", targetUserId);
  const achievedGoals = (goals ?? []).filter((g) => g.achieved_at).length;
  const goalIds = (goals ?? []).map((g) => g.id);

  let cheersReceived = 0;
  if (goalIds.length) {
    const { count } = await supabase
      .from("goal_cheers")
      .select("id", { count: "exact", head: true })
      .in("goal_id", goalIds);
    cheersReceived = count ?? 0;
  }

  return { categoryCounts, achievedGoals, cheersReceived, entryDays: entryDays.size };
}
