import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { getTodayISO } from "@/lib/today";

export default async function ColorsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { month } = await searchParams;
  const todayISO = await getTodayISO();
  const now = month ? new Date(`${month}-01T00:00:00`) : new Date(`${todayISO}T00:00:00`);
  const year = now.getFullYear();
  const monthIndex = now.getMonth();

  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);
  const startWeekday = firstOfMonth.getDay();

  const supabase = await createClient();
  const { data: colors } = await supabase
    .from("daily_colors")
    .select("color_date, hex, name")
    .gte("color_date", firstOfMonth.toLocaleDateString("sv-SE"))
    .lte("color_date", lastOfMonth.toLocaleDateString("sv-SE"));

  const byDate = new Map((colors ?? []).map((c) => [c.color_date, c]));

  const cells: { date: number | null; iso: string | null }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, iso: null });
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    cells.push({ date: d, iso: new Date(year, monthIndex, d).toLocaleDateString("sv-SE") });
  }

  const prevMonth = new Date(year, monthIndex - 1, 1).toISOString().slice(0, 7);
  const nextMonth = new Date(year, monthIndex + 1, 1).toISOString().slice(0, 7);

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div>
        <Link href="/" className="text-sm text-neutral-400">
          ‹ 홈으로
        </Link>
        <h1 className="mt-1 text-lg font-semibold">🎨 색 컬렉션</h1>
      </div>

      <div className="flex items-center justify-between">
        <a href={`?month=${prevMonth}`} className="px-2 py-1 text-neutral-400">
          ‹
        </a>
        <p className="text-sm font-medium">
          {year}년 {monthIndex + 1}월
        </p>
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
          const color = cell.iso ? byDate.get(cell.iso) : undefined;
          const isToday = cell.iso === todayISO;
          return (
            <div
              key={i}
              title={color ? `${color.name} · ${color.hex}` : undefined}
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-xs ${
                isToday ? "ring-2 ring-accent-400" : ""
              } ${color ? "" : "text-neutral-400"}`}
              style={color ? { background: color.hex } : undefined}
            >
              <span className={color ? "font-semibold text-white drop-shadow" : ""}>{cell.date}</span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-neutral-400">
        색이 채워진 날은 그날의 색이에요. 칸을 길게 누르면(또는 마우스를 올리면) 이름이 보여요.
      </p>
    </div>
  );
}
