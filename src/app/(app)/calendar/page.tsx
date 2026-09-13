import { createClient } from "@/lib/supabase/server";
import { categoryMeta } from "@/lib/categories";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const now = month ? new Date(`${month}-01T00:00:00`) : new Date();
  const year = now.getFullYear();
  const monthIndex = now.getMonth();

  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const startWeekday = firstOfMonth.getDay();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from("diary_entries")
    .select("id, entry_date, category")
    .eq("user_id", user!.id)
    .is("deleted_at", null)
    .gte("entry_date", firstOfMonth.toLocaleDateString("sv-SE"))
    .lte("entry_date", lastOfMonth.toLocaleDateString("sv-SE"));

  const byDate = new Map<string, { emoji: string }[]>();
  for (const entry of entries ?? []) {
    const list = byDate.get(entry.entry_date) ?? [];
    list.push({ emoji: categoryMeta(entry.category).emoji });
    byDate.set(entry.entry_date, list);
  }

  const cells: { date: number | null; iso: string | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, iso: null });
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    const iso = new Date(year, monthIndex, d).toLocaleDateString("sv-SE");
    cells.push({ date: d, iso });
  }

  const prevMonth = new Date(year, monthIndex - 1, 1).toISOString().slice(0, 7);
  const nextMonth = new Date(year, monthIndex + 1, 1).toISOString().slice(0, 7);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-center justify-between">
        <a href={`?month=${prevMonth}`} className="px-2 py-1 text-neutral-400">
          ‹
        </a>
        <h1 className="text-lg font-semibold">
          {year}년 {monthIndex + 1}월
        </h1>
        <a href={`?month=${nextMonth}`} className="px-2 py-1 text-neutral-400">
          ›
        </a>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400">
        {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={i} />;
          const marks = cell.iso ? byDate.get(cell.iso) : undefined;
          const isToday = cell.iso === new Date().toLocaleDateString("sv-SE");
          return (
            <div
              key={i}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-xs ${
                isToday ? "bg-amber-50 font-semibold text-amber-600" : "text-neutral-600"
              }`}
            >
              <span>{cell.date}</span>
              <span className="text-sm leading-none">{marks?.[0]?.emoji ?? ""}</span>
            </div>
          );
        })}
      </div>

      <p className="pt-2 text-center text-xs text-neutral-400">
        빈 날짜도 자유롭게 기록할 수 있어요. 밀린 일기는 없어요.
      </p>
    </div>
  );
}
