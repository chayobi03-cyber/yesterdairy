"use client";

import { useRef, useState } from "react";
import { categoryMeta } from "@/lib/categories";

type Photo = {
  id: string;
  url: string;
  category?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

export function AlbumPhotoGrid({ photos }: { photos: Photo[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pinchState = useRef<{ distance: number; scale: number } | null>(null);
  const panState = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);

  const openAt = (index: number) => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setOpenIndex(index);
  };

  const close = () => setOpenIndex(null);

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      pinchState.current = { distance, scale };
    } else if (e.touches.length === 1) {
      panState.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        offsetX: offset.x,
        offsetY: offset.y,
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchState.current) {
      const [a, b] = [e.touches[0], e.touches[1]];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const nextScale = clampScale((distance / pinchState.current.distance) * pinchState.current.scale);
      setScale(nextScale);
    } else if (e.touches.length === 1 && panState.current && scale > 1) {
      const dx = e.touches[0].clientX - panState.current.x;
      const dy = e.touches[0].clientY - panState.current.y;
      setOffset({ x: panState.current.offsetX + dx, y: panState.current.offsetY + dy });
    }
  };

  const onTouchEnd = () => {
    pinchState.current = null;
    panState.current = null;
  };

  const zoomBy = (delta: number) => {
    setScale((prev) => {
      const next = clampScale(prev + delta);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  };

  const resetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <>
      <ul className="grid grid-cols-3 gap-1.5">
        {photos.map((photo, index) => (
          <li key={photo.id} className="relative aspect-square overflow-hidden rounded-lg bg-neutral-100">
            <button
              type="button"
              onClick={() => openAt(index)}
              className="block h-full w-full"
              aria-label="사진 크게 보기"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URLs expire; a plain <img> avoids next/image's remote-domain + caching assumptions */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
            {photo.category && (
              <span className="pointer-events-none absolute bottom-1 left-1 text-xs drop-shadow">
                {categoryMeta(photo.category).emoji}
              </span>
            )}
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
          <button
            type="button"
            onClick={close}
            className="absolute left-4 top-4 z-10 rounded-full bg-black/50 px-4 py-2 text-sm"
          >
            닫기
          </button>
          <div
            className="relative flex-1 touch-none overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onDoubleClick={() => (scale > 1 ? resetZoom() : zoomBy(1))}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not a static/remote asset next/image expects */}
            <img
              src={photos[openIndex].url}
              alt=""
              draggable={false}
              className="h-full w-full select-none object-contain transition-transform duration-100"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            />
          </div>
          <div className="flex items-center justify-center gap-4 bg-black/90 p-4 pb-6 text-sm">
            <button
              type="button"
              onClick={() => zoomBy(-0.5)}
              disabled={scale <= MIN_SCALE}
              aria-label="축소"
              className="h-10 w-10 rounded-full border border-white/30 disabled:opacity-30"
            >
              −
            </button>
            <span className="w-14 text-center tabular-nums text-neutral-300">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => zoomBy(0.5)}
              disabled={scale >= MAX_SCALE}
              aria-label="확대"
              className="h-10 w-10 rounded-full border border-white/30 disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      )}
    </>
  );
}
