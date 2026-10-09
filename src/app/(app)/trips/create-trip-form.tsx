"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTrip } from "./actions";

export function CreateTripForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"template" | "blank" | "json">("template");
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("2");
  const [startDate, setStartDate] = useState("");
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm text-neutral-500"
      >
        + 새 여행 만들기
      </button>
    );
  }

  function submit() {
    setError("");
    start(async () => {
      const r = await createTrip({
        source: mode,
        templateId: "jeonju",
        title,
        days: Number(days),
        startDate,
        json,
      });
      if (!r.ok) return setError(r.error);
      // 서버 액션 안의 redirect 대신 클라이언트에서 이동 (래핑된 액션에서의 리다이렉트 버그 회피)
      router.push(`/trips/${r.id}`);
    });
  }

  const input = "rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-accent-300";
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 shadow-sm">
      <div className="flex gap-1 text-xs" role="group" aria-label="만드는 방법">
        {([["template", "전주 1박 2일 템플릿"], ["blank", "빈 여행"], ["json", "JSON 가져오기"]] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            aria-pressed={mode === v}
            onClick={() => setMode(v)}
            className={`flex-1 rounded-full border px-2 py-1.5 ${mode === v ? "border-accent-400 bg-accent-50 font-medium text-accent-700" : "border-line text-neutral-500"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={mode === "template" ? "여행 이름 (비우면 템플릿 이름)" : "여행 이름"}
        maxLength={100}
        className={input}
      />
      {mode === "blank" && (
        <input type="number" min={1} max={14} value={days} onChange={(e) => setDays(e.target.value)} aria-label="일수" className={input} />
      )}
      {mode === "json" && (
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          placeholder="여행 JSON을 붙여넣으세요 (days / places / plans)"
          rows={5}
          className={`${input} font-mono text-xs`}
        />
      )}
      <label className="text-xs text-neutral-500">
        출발일 (선택)
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`${input} mt-1 w-full`} />
      </label>
      {error && <p role="alert" className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-line px-3 py-2 text-sm text-neutral-500">
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="flex-1 rounded-xl bg-accent-400 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "만드는 중…" : "여행 만들기"}
        </button>
      </div>
    </div>
  );
}
