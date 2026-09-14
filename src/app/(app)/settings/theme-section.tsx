"use client";

import { useState } from "react";

function readStoredTheme(): string {
  if (typeof window === "undefined") return "default";
  try {
    return localStorage.getItem("haruvel-theme") ?? "default";
  } catch {
    return "default";
  }
}

const THEMES = [
  { value: "default", label: "선셋", swatch: "#f5a259" },
  { value: "peach", label: "피치", swatch: "#fb8161" },
  { value: "lavender", label: "라벤더", swatch: "#9b81f5" },
  { value: "mint", label: "민트", swatch: "#4fbd8c" },
  { value: "sky", label: "하늘", swatch: "#55a6f7" },
  { value: "rose", label: "로즈", swatch: "#f66f97" },
] as const;

export function ThemeSection() {
  const [current, setCurrent] = useState<string>(readStoredTheme);

  function selectTheme(value: string) {
    setCurrent(value);
    document.documentElement.setAttribute("data-theme", value);
    try {
      localStorage.setItem("haruvel-theme", value);
    } catch {
      // per-device preference only; safe to skip if storage is blocked
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-neutral-500">테마 색상</h2>
      <p className="text-xs text-neutral-400">이 기기에서만 적용돼요. 가족마다 다르게 꾸며도 괜찮아요.</p>
      <div className="flex flex-wrap gap-2">
        {THEMES.map((t) => (
          <button
            key={t.value}
            onClick={() => selectTheme(t.value)}
            className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs ${
              current === t.value ? "border-accent-400 bg-accent-50" : "border-line bg-card"
            }`}
          >
            <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: t.swatch }} />
            {t.label}
          </button>
        ))}
      </div>
    </section>
  );
}
