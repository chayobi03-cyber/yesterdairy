"use client";

import Link from "next/link";
import { useMemo } from "react";
import { CATS, fmt } from "@/lib/trip/engine";
import { buildTripSummary, fmtWon } from "@/lib/trip/summary";
import { TRIP_NOTE_ID, type TripPhoto } from "@/lib/trip/types";
import { useSyncedField } from "@/lib/trip/use-synced-field";
import { useTripState } from "@/lib/trip/use-trip-state";
import { dayLabel, type TripSnapshot } from "@/lib/trip/view-model";
import { PhotoStrip } from "../photo-strip";

const STATUS: Record<string, string> = { done: "✅ 완료", arrived: "📍 도착", skipped: "⏭ 건너뜀" };

export function SummaryView({ initial, plan, isCreator, userId }: { initial: TripSnapshot; plan: string; isCreator: boolean; userId: string }) {
  const { snap, pending, uploading, error, clearError, patchProgress, addPhotos, removePhoto } = useTripState(initial);
  const sum = useMemo(() => buildTripSummary(snap, plan), [snap, plan]);
  const note = snap.progress[TRIP_NOTE_ID];
  const review = useSyncedField(note?.review ?? "");
  const canDelete = (p: TripPhoto) => isCreator || p.createdBy === userId;
  const t = sum.totals;

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex items-center gap-2 print:hidden">
        <Link href={`/trips/${snap.tripId}?plan=${plan}`} aria-label="여행 화면으로" className="shrink-0 px-1 text-xl leading-none text-neutral-400">‹</Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">여행 요약</h1>
        {pending > 0 && <span role="status" className="text-xs text-neutral-400">{uploading > 0 ? `사진 올리는 중… (${uploading}장 남음)` : "저장 중…"}</span>}
        <button type="button" onClick={() => window.print()} className="min-h-9 rounded-full border border-line px-3 text-xs">인쇄 / PDF 저장</button>
      </div>

      <section aria-label="한 줄 요약" className="rounded-2xl border border-accent-200 bg-accent-50 p-4">
        <h2 className="text-base font-semibold">{snap.title}</h2>
        <p className="mt-1 text-sm" data-testid="summary-headline">{sum.headline}</p>
        {sum.badges.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="배지">
            {sum.badges.map((b) => <li key={b} className="rounded-full border border-accent-300 bg-card px-2.5 py-0.5 text-xs">{b}</li>)}
          </ul>
        )}
      </section>

      <dl className="grid grid-cols-3 gap-2 text-center" aria-label="여행 통계">
        <Stat label="다녀온 곳" value={`${t.done + t.arrived}/${t.planned}`} />
        <Stat label="건너뜀" value={String(t.skipped)} />
        <Stat label="지출" value={t.cost > 0 ? fmtWon(t.cost) : "–"} />
        <Stat label="사진" value={`${t.photos}장`} />
        <Stat label="평균 별점" value={t.avgRating != null ? `★ ${t.avgRating}` : "–"} />
        <Stat label="걸은 거리(추정)" value={t.walkKm > 0 ? `${t.walkKm}km` : "–"} />
      </dl>

      {sum.highlights.length > 0 && (
        <section aria-label="가장 좋았던 곳">
          <h2 className="mb-1 text-sm font-medium text-neutral-500">가장 좋았던 곳</h2>
          <ol className="flex flex-col gap-1">
            {sum.highlights.map((h) => (
              <li key={h.id} className="rounded-xl border border-line bg-card px-3 py-2 text-sm">
                <span className="text-amber-400">{"★".repeat(h.rating ?? 0)}</span> {h.title}
                {h.review && <span className="block text-xs text-neutral-500">{h.review}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section aria-label="여행 전체 소감" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 print:break-inside-avoid">
        <h2 className="text-sm font-medium text-neutral-600">여행 전체 소감</h2>
        <div className="flex items-center gap-1 print:hidden" role="group" aria-label="여행 별점">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`여행 별점 ${n}점`}
              aria-pressed={note?.rating === n}
              onClick={() => patchProgress(TRIP_NOTE_ID, { rating: note?.rating === n ? null : n })}
              className={`h-10 w-10 rounded-full text-xl ${(note?.rating ?? 0) >= n ? "text-amber-400" : "text-neutral-300"}`}
            >
              ★
            </button>
          ))}
        </div>
        <label className="text-xs text-neutral-500">
          우리 가족의 한 줄 소감
          <textarea
            value={review.value}
            maxLength={1000}
            onChange={(e) => review.setValue(e.target.value)}
            onBlur={() => review.dirty && patchProgress(TRIP_NOTE_ID, { review: review.commit() })}
            placeholder="이번 여행은 어땠나요?"
            className="mt-1 min-h-24 w-full rounded-xl border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent-300"
          />
        </label>
        <PhotoStrip title="여행" photos={sum.tripPhotos} canDelete={canDelete} onAdd={(files) => void addPhotos(null, files)} onRemove={removePhoto} />
      </section>

      {sum.days.map((d) => (
        <section key={d.n} aria-label={`${d.label} 기록`} className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">{dayLabel(snap, d.n)}</h2>
            <span className="text-xs text-neutral-400">{d.done}/{d.planned}곳{d.cost > 0 && ` · ${fmtWon(d.cost)}`}</span>
          </div>
          {d.stops.length === 0 && <p className="text-sm text-neutral-400">이 날은 일정이 없어요.</p>}
          <ol className="flex flex-col gap-2">
            {d.stops.map((s) => {
              const touched = s.status || s.review || s.rating || s.photos.length;
              return (
                <li key={s.id} className={`rounded-2xl border border-line bg-card p-3 print:break-inside-avoid ${touched ? "" : "opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{s.number}. {s.title}</p>
                    <span className="shrink-0 text-xs text-neutral-400">{s.status ? STATUS[s.status] : "기록 없음"}</span>
                  </div>
                  <p className="text-xs text-neutral-400">
                    {s.start != null && s.end != null && `${fmt(s.start)}–${fmt(s.end)} · `}
                    {s.cat ? `${CATS[s.cat] ?? ""} · ` : ""}
                    {s.cost != null && s.cost > 0 && `${fmtWon(s.cost)} · `}
                    {s.rating && <span className="text-amber-400">{"★".repeat(s.rating)}</span>}
                  </p>
                  {s.review && <p className="mt-1 whitespace-pre-wrap text-sm">{s.review}</p>}
                  {s.memo && <p className="mt-1 whitespace-pre-wrap text-xs text-neutral-500">메모: {s.memo}</p>}
                  {s.photos.length > 0 && <PhotoStrip title={s.title} photos={s.photos} canDelete={canDelete} onAdd={(files) => void addPhotos(s.id, files)} onRemove={removePhoto} />}
                </li>
              );
            })}
          </ol>
          {d.excludedCount > 0 && <p className="text-xs text-neutral-400">일정에서 제외한 곳 {d.excludedCount}개</p>}
        </section>
      ))}

      <p className="text-xs text-neutral-400 print:hidden">
        이 요약은 가족이 남긴 기록(완료·별점·소감·지출·사진)으로 자동 계산돼요. 걸은 거리는 계획상 이동 추정치예요.
      </p>

      {error && (
        <div role="alert" className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-[calc(100%-2.5rem)] max-w-md items-center justify-between gap-3 rounded-2xl bg-neutral-800 px-4 py-3 text-sm text-white shadow-lg print:hidden">
          <span>{error}</span>
          <button type="button" onClick={clearError} aria-label="오류 닫기" className="shrink-0 text-lg leading-none">✕</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-card px-2 py-2">
      <dt className="text-[11px] text-neutral-400">{label}</dt>
      <dd className="text-sm font-semibold">{value}</dd>
    </div>
  );
}
