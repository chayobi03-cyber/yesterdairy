import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { categoryMeta } from "@/lib/categories";
import { EventForm } from "./event-form";

// Small deterministic per-person color for the tiny "who wrote this" dots --
// same hash-based approach used elsewhere (creatures, colors), so a given
// family member always gets the same dot color.
const AUTHOR_DOT_COLORS = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];
function authorColor(userId: string) {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AUTHOR_DOT_COLORS[h % AUTHOR_DOT_COLORS.length];
}

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

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [{ data: entries }, { data: events }] = await Promise.all([
    // No .eq("user_id", ...) filter here -- RLS already scopes this to the
    // caller's own rows (any visibility) plus other family members' rows
    // that are visibility='family', so this naturally becomes "my personal
    // calendar plus what family shared" without any extra logic.
    supabase
      .from("diary_entries")
      .select("id, entry_date, category, user_id, profiles(name)")
      .is("deleted_at", null)
      .gte("entry_date", firstOfMonth.toLocaleDateString("sv-SE"))
      .lte("entry_date", lastOfMonth.toLocaleDateString("sv-SE")),
    supabase
      .from("events")
      .select("id, event_date, title")
      .eq("user_id", user.id)
      .gte("event_date", firstOfMonth.toLocaleDateString("sv-SE"))
      .lte("event_date", lastOfMonth.toLocaleDateString("sv-SE"))
      .order("event_date", { ascending: true }),
  ]);

  const byDate = new Map<string, { emoji: string; userId: string }[]>();
  const nameByUser = new Map<string, string>();
  for (const entry of entries ?? []) {
    const list = byDate.get(entry.entry_date) ?? [];
    list.push({ emoji: categoryMeta(entry.category).emoji, userId: entry.user_id });
    byDate.set(entry.entry_date, list);
    const name = (entry.profiles as unknown as { name: string } | null)?.name;
    if (name) nameByUser.set(entry.user_id, name);
  }

  const eventsByDate = new Map<string, string[]>();
  for (const event of events ?? []) {
    const list = eventsByDate.get(event.event_date) ?? [];
    list.push(event.title);
    eventsByDate.set(event.event_date, list);
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
          const hasEvent = cell.iso ? eventsByDate.has(cell.iso) : false;
          const isToday = cell.iso === new Date().toLocaleDateString("sv-SE");
          return (
            <div
              key={i}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-xs ${
                isToday ? "bg-accent-50 font-semibold text-accent-600" : "text-neutral-600"
              }`}
            >
              <span>{cell.date}</span>
              <span className="text-sm leading-none">{marks?.[0]?.emoji ?? ""}</span>
              {!!marks?.length && (
                <span className="mt-0.5 flex gap-[3px]">
                  {[...new Set(marks.map((m) => m.userId))].slice(0, 4).map((userId) => (
                    <span
                      key={userId}
                      title={nameByUser.get(userId)}
                      className="h-1 w-1 rounded-full"
                      style={{ background: authorColor(userId) }}
                    />
                  ))}
                </span>
              )}
              {hasEvent && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-sky-400" />}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-neutral-400">
        빈 날짜도 자유롭게 기록할 수 있어요. 밀린 일기는 없어요.
      </p>

      <section className="flex flex-col gap-2 pt-2">
        <h2 className="text-sm font-medium text-neutral-500">📌 이번 달 일정</h2>
        {!!events?.length && (
          <ul className="flex flex-col gap-1.5">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-2 rounded-xl bg-sky-50 px-3 py-2 text-sm">
                <span className="text-xs text-sky-600">{event.event_date.slice(5)}</span>
                <span className="text-neutral-700">{event.title}</span>
              </li>
            ))}
          </ul>
        )}
        <EventForm />
      </section>
    </div>
  );
}
