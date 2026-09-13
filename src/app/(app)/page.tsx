import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { categoryMeta } from "@/lib/categories";
import { signOut } from "@/app/actions";

function todayISO() {
  return new Date().toLocaleDateString("sv-SE"); // yyyy-mm-dd, local time
}

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user!.id)
    .single();

  const today = todayISO();
  const { data: todayEntries } = await supabase
    .from("diary_entries")
    .select("id, category, content, visibility, created_at")
    .eq("user_id", user!.id)
    .eq("entry_date", today)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

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
        href="/write"
        className="flex items-center justify-center gap-2 rounded-3xl bg-amber-400 px-6 py-4 text-sm font-medium text-white shadow-sm active:scale-[0.98]"
      >
        ✏️ 오늘의 순간 기록하기
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-medium text-neutral-500">오늘의 기록</h2>
        {!todayEntries?.length ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-6 text-center text-sm text-neutral-400">
            아직 오늘 기록이 없어요. 지금 적어도 그날의 기록이에요.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {todayEntries.map((entry) => {
              const meta = categoryMeta(entry.category);
              return (
                <li key={entry.id} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2 text-sm">
                    <span>{meta.emoji}</span>
                    <span className="font-medium">{meta.label}</span>
                    {entry.visibility === "family" && (
                      <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-600">
                        가족 공개
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-neutral-700">{entry.content}</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <form action={signOut} className="mt-auto pt-4 text-center">
        <button type="submit" className="text-xs text-neutral-400 underline">
          로그아웃
        </button>
      </form>
    </div>
  );
}
