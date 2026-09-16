"use client";

import { useRef, useState } from "react";

type Photo = { id: string; url: string };

const LAYOUTS = [
  { cols: 2, count: 4, label: "2x2 (4장)" },
  { cols: 3, count: 9, label: "3x3 (9장)" },
] as const;

const OUTPUT_SIZE = 960;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했어요."));
    img.src = url;
  });
}

// Draws `img` into the (x, y, size, size) cell the same way CSS
// `object-fit: cover` would -- crop to the cell's aspect (always square
// here) and center it, instead of stretching non-square photos.
function drawCovered(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, size: number) {
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.drawImage(img, sx, sy, side, side, x, y, size, size);
}

export function CollageMaker({ photos }: { photos: Photo[] }) {
  const [layoutIndex, setLayoutIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const layout = LAYOUTS[layoutIndex];
  const byId = new Map(photos.map((p) => [p.id, p]));

  const toggle = (id: string) => {
    setResultUrl(null);
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= layout.count) return prev;
      return [...prev, id];
    });
  };

  const changeLayout = (index: number) => {
    setLayoutIndex(index);
    setResultUrl(null);
    setSelected((prev) => prev.slice(0, LAYOUTS[index].count));
  };

  const canMake = selected.length === layout.count;

  const handleMake = async () => {
    setError(null);
    setRendering(true);
    try {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const cell = OUTPUT_SIZE / layout.cols;
      const images = await Promise.all(selected.map((id) => loadImage(byId.get(id)!.url)));
      images.forEach((img, i) => {
        const col = i % layout.cols;
        const row = Math.floor(i / layout.cols);
        drawCovered(ctx, img, col * cell, row * cell, cell);
      });
      setResultUrl(canvas.toDataURL("image/png"));
    } catch {
      setError("콜라주를 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {LAYOUTS.map((l, i) => (
          <button
            key={l.label}
            type="button"
            onClick={() => changeLayout(i)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              i === layoutIndex ? "bg-accent-400 text-white" : "border border-line text-neutral-500"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      <p className="text-xs text-neutral-400">
        {selected.length}/{layout.count}장 선택됨 -- 선택한 순서대로 왼쪽 위부터 채워져요.
      </p>

      <ul className="grid grid-cols-3 gap-1.5">
        {photos.map((photo) => {
          const order = selected.indexOf(photo.id);
          const isSelected = order !== -1;
          return (
            <li key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
              <button
                type="button"
                onClick={() => toggle(photo.id)}
                className="block h-full w-full"
                aria-pressed={isSelected}
                aria-label={isSelected ? `선택 해제 (${order + 1}번째)` : "콜라주에 추가"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, expires */}
                <img
                  src={photo.url}
                  alt=""
                  className={`h-full w-full object-cover ${isSelected ? "opacity-60" : ""}`}
                />
              </button>
              {isSelected && (
                <span className="pointer-events-none absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent-400 text-xs font-semibold text-white">
                  {order + 1}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={handleMake}
        disabled={!canMake || rendering}
        className="rounded-full bg-accent-400 py-2.5 text-sm font-medium text-white disabled:opacity-40"
      >
        {rendering ? "만드는 중..." : "콜라주 만들기"}
      </button>

      {error && <p className="text-center text-xs text-red-500">{error}</p>}

      <canvas ref={canvasRef} className="hidden" />

      {resultUrl && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- data: URL preview, not a remote asset */}
          <img src={resultUrl} alt="완성된 콜라주" className="w-full rounded-lg" />
          <a
            href={resultUrl}
            download="collage.png"
            className="rounded-full border border-accent-400 px-4 py-2 text-sm font-medium text-accent-600"
          >
            📥 다운로드
          </a>
        </div>
      )}
    </div>
  );
}
