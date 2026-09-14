import type { SupabaseClient } from "@supabase/supabase-js";
import type { ItemStats } from "@/lib/items";

// Works for any target user, including someone other than the caller.
// No extra privacy logic needed here: RLS already scopes what comes back —
// the caller's own rows regardless of visibility, another family member's
// only if they're visibility='family'. So a stranger's room (or a private
// entry) never leaks through this.
export async function getItemStats(supabase: SupabaseClient, targetUserId: string): Promise<ItemStats> {
  // entries and goals don't depend on each other — fire both at once
  // instead of paying two sequential round trips.
  const [{ data: entries }, { data: goals }] = await Promise.all([
    supabase.from("diary_entries").select("category, entry_date").eq("user_id", targetUserId).is("deleted_at", null),
    supabase.from("goals").select("id, achieved_at").eq("user_id", targetUserId),
  ]);

  const categoryCounts: Record<string, number> = {};
  const entryDays = new Set<string>();
  for (const e of entries ?? []) {
    categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;
    entryDays.add(e.entry_date);
  }
  const totalEntries = entries?.length ?? 0;

  const achievedGoals = (goals ?? []).filter((g) => g.achieved_at).length;
  const goalIds = (goals ?? []).map((g) => g.id);

  // cheersReceived depends on goalIds, cheersGiven doesn't — run them together.
  const [cheersReceivedResult, cheersGivenResult] = await Promise.all([
    goalIds.length
      ? supabase.from("goal_cheers").select("id", { count: "exact", head: true }).in("goal_id", goalIds)
      : Promise.resolve({ count: 0 }),
    supabase.from("goal_cheers").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
  ]);

  return {
    categoryCounts,
    achievedGoals,
    cheersReceived: cheersReceivedResult.count ?? 0,
    cheersGiven: cheersGivenResult.count ?? 0,
    entryDays: entryDays.size,
    totalEntries,
  };
}
