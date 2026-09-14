"use client";

import { useState } from "react";
import { updateWorldType } from "@/app/actions";

const WORLDS = [
  { value: "tree", emoji: "🌳", label: "나무" },
  { value: "constellation", emoji: "🌌", label: "별자리" },
  { value: "planet", emoji: "🪐", label: "행성" },
  { value: "color", emoji: "🎨", label: "색모음집" },
] as const;

export function WorldSection({ currentWorld }: { currentWorld: string }) {
  const [current, setCurrent] = useState(currentWorld);
  const [pending, setPending] = useState(false);

  async function select(value: string) {
    if (value === current) return;
    setPending(true);
    setCurrent(value);
    try {
      await updateWorldType(value);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-neutral-500">성장 세계관</h2>
      <p className="text-xs text-neutral-400">내 공간에서 보여줄 모습이에요. 가족마다 다르게 골라도 돼요.</p>
      <div className="flex gap-2">
        {WORLDS.map((w) => (
          <button
            key={w.value}
            disabled={pending}
            onClick={() => select(w.value)}
            className={`flex flex-1 flex-col items-center gap-1 rounded-2xl border px-3 py-3 text-xs disabled:opacity-60 ${
              current === w.value ? "border-accent-400 bg-accent-50" : "border-line bg-card"
            }`}
          >
            <span className="text-2xl">{w.emoji}</span>
            {w.label}
          </button>
        ))}
      </div>
    </section>
  );
}
