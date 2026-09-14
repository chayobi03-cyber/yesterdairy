"use client";

import { useState } from "react";
import { createEvent } from "@/app/actions";

function todayISO() {
  return new Date().toLocaleDateString("sv-SE");
}

export function EventForm() {
  const [visibility, setVisibility] = useState<"private" | "family">("private");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-2xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm text-neutral-500"
      >
        + 일정 추가
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await createEvent(formData);
        setOpen(false);
        setVisibility("private");
      }}
      className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3 shadow-sm"
    >
      <input
        name="title"
        required
        placeholder="미용실, 밥약속, 가족 여행처럼 뭐든 좋아요"
        className="rounded-xl border border-line px-3 py-2 text-sm outline-none focus:border-accent-300"
      />
      <div className="flex items-center gap-2">
        <input
          type="date"
          name="event_date"
          required
          defaultValue={todayISO()}
          className="rounded-xl border border-line px-3 py-2 text-sm text-neutral-600 outline-none focus:border-accent-300"
        />
        <button
          type="button"
          onClick={() => setVisibility((v) => (v === "private" ? "family" : "private"))}
          className={`ml-auto rounded-full px-3 py-1.5 text-xs ${
            visibility === "family" ? "bg-accent-100 text-accent-700" : "bg-neutral-100 text-neutral-500"
          }`}
        >
          {visibility === "family" ? "가족 공개" : "나만 보기"}
        </button>
        <input type="hidden" name="visibility" value={visibility} />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="flex-1 rounded-xl bg-accent-400 px-3 py-2 text-sm font-medium text-white shadow-sm shadow-accent-200/60 transition active:scale-[0.98]">
          추가
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-neutral-400">
          취소
        </button>
      </div>
    </form>
  );
}
