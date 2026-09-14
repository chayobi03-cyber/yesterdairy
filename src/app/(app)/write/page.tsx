"use client";

import { useState } from "react";
import { createEntry } from "@/app/actions";
import { CATEGORIES } from "@/lib/categories";

function todayISO() {
  return new Date().toLocaleDateString("sv-SE");
}

export default function WritePage() {
  const [category, setCategory] = useState<string>(CATEGORIES[0].value);
  const [visibility, setVisibility] = useState<"private" | "family">("private");
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        setPending(true);
        try {
          await createEntry(formData);
        } finally {
          setPending(false);
        }
      }}
      className="flex flex-col gap-5 pt-2"
    >
      <div>
        <h1 className="text-lg font-semibold">오늘의 순간</h1>
        <p className="mt-1 text-sm text-neutral-500">한 번에 질문 하나만. 편하게 골라볼래?</p>
      </div>

      <input type="hidden" name="entry_date" value={todayISO()} />

      <div className="grid grid-cols-5 gap-2">
        {CATEGORIES.map((c) => (
          <label
            key={c.value}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border px-1 py-3 text-center text-[11px] ${
              category === c.value ? "border-accent-400 bg-accent-50" : "border-line"
            }`}
          >
            <input
              type="radio"
              name="category"
              value={c.value}
              checked={category === c.value}
              onChange={() => setCategory(c.value)}
              className="sr-only"
            />
            <span className="text-xl">{c.emoji}</span>
            {c.label}
          </label>
        ))}
      </div>

      <textarea
        name="content"
        required
        rows={4}
        placeholder="그 일에서 알게 된 건? 한 줄로도 충분해요."
        className="rounded-2xl border border-line px-4 py-3 text-sm outline-none focus:border-accent-300"
      />

      <div>
        <label className="mb-1 block text-sm text-neutral-500">사진 (최대 5장)</label>
        <input
          type="file"
          name="photos"
          accept="image/*"
          multiple
          capture="environment"
          className="block w-full text-sm text-neutral-500 file:mr-3 file:rounded-full file:border-0 file:bg-accent-100 file:px-3 file:py-1.5 file:text-accent-700"
        />
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
        <div>
          <p className="text-sm font-medium">가족에게 공개할까요?</p>
          <p className="text-xs text-neutral-400">기본은 나만 보기예요.</p>
        </div>
        <button
          type="button"
          onClick={() => setVisibility((v) => (v === "private" ? "family" : "private"))}
          className={`h-7 w-12 rounded-full transition ${visibility === "family" ? "bg-accent-400" : "bg-neutral-200"}`}
        >
          <span
            className={`block h-6 w-6 translate-x-0.5 rounded-full bg-card shadow transition ${
              visibility === "family" ? "translate-x-[22px]" : ""
            }`}
          />
        </button>
        <input type="hidden" name="visibility" value={visibility} />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-2xl bg-accent-400 px-4 py-3 text-sm font-medium text-white shadow-sm shadow-accent-200/60 transition active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "저장 중..." : "기록하기"}
      </button>
    </form>
  );
}
