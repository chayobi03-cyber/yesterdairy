"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDailyColor } from "@/app/actions";

// Downscales the photo onto a tiny canvas and averages its pixels -- a
// cheap, dependency-free way to get "the color of this moment" with no
// external API and nothing uploaded or stored beyond the resulting hex.
function averageColorFromImage(img: HTMLImageElement): string {
  const size = 24;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#cccccc";
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  const toHex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function DailyColorCapture({ initialHex }: { initialHex: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [hex, setHex] = useState(initialHex);
  const [pending, startTransition] = useTransition();

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const nextHex = averageColorFromImage(img);
      URL.revokeObjectURL(url);
      setHex(nextHex);
      startTransition(async () => {
        const formData = new FormData();
        formData.set("hex", nextHex);
        formData.set("color_date", new Date().toLocaleDateString("sv-SE"));
        await saveDailyColor(formData);
        // Refreshes the server-rendered 7-day strip on this same page --
        // the swatch above already updated instantly from local state.
        router.refresh();
      });
    };
    img.src = url;
  };

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full items-center gap-3 text-left"
      >
        {hex ? (
          <span className="h-11 w-11 shrink-0 rounded-full border border-line" style={{ background: hex }} />
        ) : (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-50 text-lg">
            🎨
          </span>
        )}
        <span className="flex-1">
          <span className="block text-sm font-medium">
            {hex ? "오늘의 색" : "오늘의 색 찍기"}
          </span>
          <span className="block text-xs text-neutral-400">
            {pending ? "저장 중..." : hex ? "다시 찍으려면 탭하세요" : "카메라로 아무거나 찍으면 색이 남아요"}
          </span>
        </span>
      </button>
    </div>
  );
}
