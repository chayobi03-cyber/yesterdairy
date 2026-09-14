// Current consecutive-day streak, derived purely from the user's own entry
// dates -- no separate "pet" table to keep in sync, no decay job to run.
// Breaking the streak (missing a day) resets it back to 0 the next time
// this is computed; today not having an entry yet doesn't break it.

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("sv-SE");
}

export function computeStreak(entryDates: string[]): number {
  const dates = new Set(entryDates);
  const today = new Date().toLocaleDateString("sv-SE");
  const anchor = dates.has(today) ? today : addDays(today, -1);
  if (!dates.has(anchor)) return 0;

  let count = 0;
  let cursor = anchor;
  while (dates.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}
