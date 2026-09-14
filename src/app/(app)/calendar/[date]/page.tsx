import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { categoryMeta } from "@/lib/categories";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarDayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!DATE_RE.test(date)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const [{ data: entries }, { data: events }] = await Promise.all([
    // No .eq("user_id", ...) filter -- RLS scopes this to the caller's own
    // entries (any visibility) plus family members' family-visible ones,
    // same pattern as the month view this links from.
    supabase
      .from("diary_entries")
      .select("id, category, content, visibility, user_id, profiles(name)")
      .eq("entry_date", date)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("events").select("id, title").eq("user_id", user.id).eq("event_date", date),
  ]);

  const dateObj = new Date(`${date}T00:00:00`);
  const heading = dateObj.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "long" });

  return (
    <div className="flex flex-col gap-4 pt-2">
      <Link href="/calendar" className="text-sm text-neutral-400">
        ‹ 달력으로
      </Link>

      <h1 className="text-lg font-semibold">{heading}</h1>

      <Link
        href={`/write?date=${date}`}
        className="flex items-center justify-center gap-2 rounded-2xl bg-accent-400 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-accent-200/60 transition active:scale-[0.98]"
      >
        ✏️ 이 날짜에 기록하기
      </Link>

      {!!events?.length && (
        <ul className="flex flex-col gap-1.5">
          {events.map((event) => (
            <li key={event.id} className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-700">
              📌 {event.title}
            </li>
          ))}
        </ul>
      )}

      {!entries?.length ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-neutral-400">
          이 날은 아직 기록이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => {
            const meta = categoryMeta(entry.category);
            const isMine = entry.user_id === user.id;
            const authorName = (entry.profiles as unknown as { name: string } | null)?.name ?? "가족";
            return (
              <li key={entry.id} className="rounded-2xl border border-line bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm">
                  <span>{meta.emoji}</span>
                  <span className="font-medium">{isMine ? "나" : authorName}</span>
                  {entry.visibility === "family" && (
                    <span className="rounded-full bg-accent-50 px-2 py-0.5 text-[11px] text-accent-600">
                      가족 공개
                    </span>
                  )}
                  {isMine && (
                    <Link
                      href={`/write/${entry.id}`}
                      className="ml-auto text-xs text-neutral-400 underline underline-offset-2"
                    >
                      수정
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-sm text-neutral-700">{entry.content}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
