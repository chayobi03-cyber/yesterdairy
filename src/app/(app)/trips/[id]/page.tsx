import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/get-current-user";
import { allDays, dayItems, loadTrip, loadTripState } from "@/lib/trip/data";
import { CATS, currentIndex, directionsUrl, fmt, hasCoord, mandatoryStatus, timeline } from "@/lib/trip/engine";
import type { Place } from "@/lib/trip/types";
import { AutoRefresh } from "@/components/trip/auto-refresh";
import { PlaceCard } from "./place-card";
import { AddItemForm, AddPlaceForm, ItemTools, ResetDayButton } from "./plan-tools";
import { DeleteTripButton } from "./delete-trip-button";

type SP = { plan?: string; day?: string; view?: string; focus?: string };

const STATUS_BADGE: Record<string, string> = { arrived: "도착", done: "완료", skipped: "건너뜀" };

export default async function TripPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const trip = await loadTrip(supabase, id);
  if (!trip) notFound();
  const { ov, prog } = await loadTripState(supabase, id);
  const def = trip.def;

  const planIds = Object.keys(def.plans);
  const planId = sp.plan && def.plans[sp.plan] ? sp.plan : def.defaultPlan && def.plans[def.defaultPlan] ? def.defaultPlan : planIds[0];
  const dayNum = def.days.some((d) => String(d.n) === sp.day) ? Number(sp.day) : def.days[0].n;
  const view = sp.view === "plan" ? "plan" : "now";
  const dayMeta = def.days.find((d) => d.n === dayNum)!;

  const placesById: Record<string, Place> = Object.fromEntries(def.places.map((p) => [p.id, p]));
  const items = dayItems(def, ov, planId, dayNum);
  const rows = timeline(items, placesById, dayMeta.start);
  const included = rows.filter((r) => r.included);
  const statusOf = Object.fromEntries(items.map((i) => [i.id, prog.get(i.id)?.status ?? null]));

  const mandatory = (def.mandatory ?? []).filter((m) => placesById[m]);
  const excluded = mandatoryStatus(mandatory, allDays(def, ov, planId)).excluded.map((m) => placesById[m].name);

  const href = (over: Partial<SP>) => {
    const q = new URLSearchParams({ plan: planId, day: String(dayNum), view, ...(over as Record<string, string>) });
    if (over.focus === undefined) q.delete("focus");
    return `/trips/${id}?${q.toString()}`;
  };
  const dayLabel = (n: number) => {
    const base = def.days.find((d) => d.n === n)?.label ?? `${n}일차`;
    if (!trip.start_date) return base;
    const d = new Date(`${trip.start_date}T12:00:00`);
    d.setDate(d.getDate() + n - 1);
    return `${base} (${d.getMonth() + 1}/${d.getDate()})`;
  };

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1.5 text-sm ${active ? "border-accent-400 bg-accent-50 font-medium text-accent-700" : "border-line text-neutral-500"}`;

  const done = included.filter((r) => statusOf[r.item.id] === "done").length;
  const skipped = included.filter((r) => statusOf[r.item.id] === "skipped").length;
  const pct = included.length ? Math.round(((done + skipped) / included.length) * 100) : 0;
  const total = [...prog.values()].reduce((s, p) => s + (p.cost ?? 0), 0);

  const ctx = { tripId: id, planId, day: dayNum };

  let body: React.ReactNode;
  if (view === "plan") {
    const span = included.length ? `${fmt(included[0].start!)} 시작 → ${fmt(included[included.length - 1].end!)} 종료 예상 (계획용 추정)` : "";
    body = (
      <div className="flex flex-col gap-2">
        {span && <p className="text-xs text-neutral-400">{span}</p>}
        {rows.map((r, i) => {
          const isMust = !!r.place && mandatory.includes(r.place.id);
          return (
            <div key={r.item.id}>
              {r.travel && (
                <p className="ml-3 border-l-2 border-dotted border-line pl-3 text-xs text-neutral-400">
                  {r.travel.mode === "car" ? "🚗 차량" : "🚶 도보"} 약 {r.travel.min}분 · {r.travel.km.toFixed(1)}km (추정)
                </p>
              )}
              <div className={`rounded-2xl border border-line bg-card p-3 ${r.included ? "" : "opacity-50"}`}>
                <div className="flex items-start gap-3">
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-accent-600">{r.included ? fmt(r.start!) : "—"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {r.place?.name ?? r.item.rest}
                      {isMust && <span className="ml-1.5 rounded-full border border-accent-400 px-1.5 text-[10px] text-accent-700">필수</span>}
                      {statusOf[r.item.id] && <span className="ml-1.5 rounded-full border border-line px-1.5 text-[10px] text-neutral-500">{STATUS_BADGE[statusOf[r.item.id]!]}</span>}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {r.place?.cat ? `${CATS[r.place.cat] ?? ""} · ` : ""}{r.dur}분{r.included ? ` → ${fmt(r.end!)}` : " · 제외됨"}
                    </p>
                    <Link href={href({ view: "now", focus: r.item.id })} className="text-xs text-accent-600 underline">진행 보기 ▶</Link>
                  </div>
                </div>
                <ItemTools ctx={ctx} itemId={r.item.id} index={i} count={rows.length} included={r.included} mandatory={isMust} placeName={r.place?.name ?? ""} />
              </div>
            </div>
          );
        })}
        <AddItemForm ctx={ctx} places={def.places.map((p) => ({ id: p.id, name: p.name }))} />
        <AddPlaceForm ctx={ctx} />
        <ResetDayButton ctx={ctx} />
      </div>
    );
  } else if (!included.length) {
    body = <p className="rounded-2xl border border-line bg-card p-4 text-sm text-neutral-500">이 날짜에는 포함된 일정이 없어요. 「일정」 탭에서 추가해보세요.</p>;
  } else {
    const focusIdx = sp.focus ? included.findIndex((r) => r.item.id === sp.focus) : -1;
    const curItemIdx = currentIndex(items, statusOf);
    const cur = focusIdx >= 0 ? included[focusIdx] : curItemIdx >= 0 ? included.find((r) => r.item.id === items[curItemIdx].id) : undefined;
    body = (
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="장소 선택" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
          {included.map((r, i) => {
            const st = statusOf[r.item.id];
            const isCur = cur?.item.id === r.item.id;
            return (
              <Link
                key={r.item.id}
                href={href({ focus: r.item.id })}
                aria-current={isCur ? "step" : undefined}
                className={`max-w-40 shrink-0 truncate rounded-full border px-3 py-1.5 text-xs ${isCur ? "border-accent-400 bg-accent-400 text-white" : "border-line"} ${st === "done" || st === "skipped" ? "opacity-60" : ""}`}
              >
                {st === "done" ? "✓ " : st === "skipped" ? "– " : `${i + 1}. `}{r.place?.name ?? r.item.rest}
              </Link>
            );
          })}
        </div>
        {cur ? (() => {
          const idx = included.indexOf(cur);
          const next = included[idx + 1];
          const p = cur.place;
          const pg = prog.get(cur.item.id);
          return (
            <PlaceCard
              key={cur.item.id}
              tripId={id}
              itemId={cur.item.id}
              index={idx + 1}
              title={p?.name ?? cur.item.rest ?? "일정"}
              timeText={`${fmt(cur.start!)}–${fmt(cur.end!)}`}
              travelText={cur.travel ? `이전 장소에서 ${cur.travel.mode === "car" ? "🚗" : "🚶"} 약 ${cur.travel.min}분 (추정)` : null}
              desc={p?.desc}
              hours={p?.hours}
              approx={p?.approx}
              tips={p?.tips ?? []}
              food={p?.food ?? []}
              checks={p?.checks ?? []}
              walkUrl={p && (hasCoord(p) || p.addr) ? directionsUrl(p, "walk") : null}
              carUrl={p && (hasCoord(p) || p.addr) ? directionsUrl(p, "car") : null}
              status={pg?.status ?? null}
              checked={pg?.checks ?? {}}
              memo={pg?.memo ?? ""}
              cost={pg?.cost ?? null}
              nextHref={next ? href({ focus: next.item.id }) : null}
              nextName={next ? (next.place?.name ?? next.item.rest ?? "다음") : null}
            />
          );
        })() : (
          <div className="rounded-2xl border border-line bg-card p-4">
            <h2 className="text-base font-semibold">🎉 오늘 일정 끝!</h2>
            <p className="text-sm text-neutral-500">모든 장소를 완료하거나 건너뛰었어요. 위에서 장소를 눌러 기록을 다시 볼 수 있어요.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pt-2">
      <AutoRefresh />
      <Link href="/trips" className="text-sm text-neutral-400">‹ 여행 목록</Link>
      <div>
        <h1 className="text-lg font-semibold">{trip.title}</h1>
        <p className="text-xs text-neutral-400">
          {[def.dest, def.party, trip.start_date ? `${trip.start_date} 출발` : ""].filter(Boolean).join(" · ")}
        </p>
      </div>

      {planIds.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="여행 대안">
          {planIds.map((k) => (
            <Link key={k} href={href({ plan: k })} aria-current={k === planId ? "true" : undefined} className={chip(k === planId)}>{def.plans[k].label}</Link>
          ))}
        </div>
      )}
      {def.plans[planId].desc && planIds.length > 1 && <p className="text-xs text-neutral-400">{def.plans[planId].desc}</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="날짜">
        {def.days.map((d) => (
          <Link key={d.n} href={href({ day: String(d.n) })} aria-current={d.n === dayNum ? "true" : undefined} className={chip(d.n === dayNum)}>{dayLabel(d.n)}</Link>
        ))}
      </div>

      <div className="flex gap-1 rounded-full bg-neutral-100 p-1 text-sm" role="tablist" aria-label="보기">
        {([["now", "장소별 진행"], ["plan", "일정"]] as const).map(([v, label]) => (
          <Link key={v} href={href({ view: v })} role="tab" aria-selected={view === v} className={`flex-1 rounded-full py-1.5 text-center ${view === v ? "bg-white font-medium shadow-sm" : "text-neutral-500"}`}>{label}</Link>
        ))}
      </div>

      {excluded.length > 0 && (
        <p role="alert" className="rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-700">⚠️ 필수 방문지가 일정에서 제외돼 있어요: {excluded.join(", ")}</p>
      )}

      <div className="rounded-2xl border border-line bg-card p-3">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{dayLabel(dayNum)} 진행</span>
          <span>{done}완료 · {skipped}건너뜀 / {included.length}곳</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-accent-400" style={{ width: `${pct}%` }} />
        </div>
        {total > 0 && <p className="mt-2 text-xs text-neutral-400">누적 지출 기록 {total.toLocaleString("ko-KR")}원</p>}
      </div>

      {body}

      <p className="text-xs text-neutral-400">
        운영시간·예약·공연·주차요금·좌표는 실시간 확인 결과가 아닌 참고 정보예요. 방문 전 공식 채널에서 확인하세요. 이동·체류시간은 계획용 추정치예요. 사진은 아직 여행에 첨부되지 않아요.
      </p>
      {trip.created_by === user.id && <DeleteTripButton tripId={id} />}
    </div>
  );
}
