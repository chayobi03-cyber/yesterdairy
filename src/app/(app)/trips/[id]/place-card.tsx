"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProgress } from "../actions";
import type { ProgressStatus } from "@/lib/trip/types";

export type PlaceCardData = {
  tripId: string;
  itemId: string;
  index: number;
  title: string;
  timeText: string;
  travelText: string | null;
  desc?: string;
  hours?: string;
  approx?: boolean;
  tips: string[];
  food: string[];
  checks: string[];
  walkUrl: string | null;
  carUrl: string | null;
  status: ProgressStatus | null;
  checked: Record<string, boolean>;
  memo: string;
  cost: number | null;
  nextHref: string | null;
  nextName: string | null;
};

const STATUS_LABEL: Record<ProgressStatus, string> = { arrived: "📍 도착", done: "✅ 완료", skipped: "⏭ 건너뜀" };

export function PlaceCard(d: PlaceCardData) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [memo, setMemo] = useState(d.memo);
  const [cost, setCost] = useState(d.cost == null ? "" : String(d.cost));

  function run(patch: Parameters<typeof updateProgress>[2], after?: () => void) {
    setError("");
    start(async () => {
      const r = await updateProgress(d.tripId, d.itemId, patch);
      if (!r.ok) return setError(r.error);
      if (after) after();
      else router.refresh();
    });
  }

  const btn = "rounded-xl border px-3 py-2 text-sm disabled:opacity-50";
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4" aria-label={`${d.index}. ${d.title}`}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-semibold">
          {d.index}. {d.title}
        </h2>
        <span className="shrink-0 text-xs text-accent-600">{d.timeText}</span>
      </div>
      {d.travelText && <p className="text-xs text-neutral-400">{d.travelText}</p>}
      {d.desc && <p className="text-sm">{d.desc}</p>}
      {d.hours && (
        <p className="rounded-xl bg-accent-50 px-3 py-2 text-xs text-accent-700">
          🕒 {d.hours} — 참고 정보이며 실시간 확인 결과가 아니에요.
        </p>
      )}
      {(d.walkUrl || d.carUrl) && (
        <div className="flex gap-3 text-sm">
          {d.walkUrl && <a href={d.walkUrl} target="_blank" rel="noopener noreferrer" className="text-accent-600 underline">🚶 도보 길찾기 ↗</a>}
          {d.carUrl && <a href={d.carUrl} target="_blank" rel="noopener noreferrer" className="text-accent-600 underline">🚗 차량 길찾기 ↗</a>}
        </div>
      )}
      {d.approx && <p className="text-xs text-neutral-400">※ 지도 좌표는 근사치예요. 길찾기 전에 위치를 확인하세요.</p>}

      <div className="flex flex-wrap gap-2" role="group" aria-label="진행 상태">
        {(Object.keys(STATUS_LABEL) as ProgressStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending}
            aria-pressed={d.status === s}
            onClick={() => run({ status: s })}
            className={`${btn} ${d.status === s ? "border-accent-400 bg-accent-400 text-white" : "border-line"}`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
        {d.status && (
          <button type="button" disabled={pending} onClick={() => run({ status: null })} className={`${btn} border-transparent text-neutral-400`}>
            되돌리기
          </button>
        )}
      </div>

      {d.checks.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-medium text-neutral-500">방문 전 확인</h3>
          {d.checks.map((c, i) => (
            <label key={i} className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[var(--accent-500)]"
                checked={!!d.checked[String(i)]}
                disabled={pending}
                onChange={(e) => run({ checkIndex: i, checked: e.target.checked })}
              />
              {c}
            </label>
          ))}
          <p className="text-xs text-neutral-400">체크는 직접 확인했다는 표시예요. 앱이 검증한 결과가 아니에요.</p>
        </div>
      )}
      {d.tips.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-neutral-500">
          {d.tips.map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
      {d.food.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {d.food.map((f, i) => <span key={i} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-neutral-500">{f}</span>)}
        </div>
      )}

      <label className="text-xs text-neutral-500">
        메모 (가족 모두에게 보여요)
        <textarea
          value={memo}
          maxLength={2000}
          onChange={(e) => setMemo(e.target.value)}
          onBlur={() => memo !== d.memo && run({ memo })}
          placeholder="예약번호, 주차 위치, 느낀 점…"
          className="mt-1 min-h-20 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-accent-300"
        />
      </label>
      <label className="text-xs text-neutral-500">
        지출 (원)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={100}
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          onBlur={() => {
            const next = cost === "" ? null : Number(cost);
            if (next !== d.cost) run({ cost: next });
          }}
          className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-accent-300"
        />
      </label>

      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}

      {d.nextHref ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ status: "done" }, () => router.push(d.nextHref!))}
          className="rounded-2xl bg-accent-400 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-accent-200/60 disabled:opacity-50"
        >
          완료하고 다음: {d.nextName} ▶
        </button>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run({ status: "done" })}
          className="rounded-2xl bg-accent-400 px-4 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          마지막 장소 완료 🎉
        </button>
      )}
    </section>
  );
}
