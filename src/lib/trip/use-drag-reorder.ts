"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { dragTargetIndex } from "./engine";

// 편집 모드에서 손잡이(⠿)를 눌러 끌면 목록 순서를 바꾼다.
// 놓을 때 한 번만 onDrop(from, to)을 호출한다. 목록의 각 칸에는 data-stop-li가 있어야 한다.
export function useDragReorder(onDrop: (from: number, to: number) => void) {
  const listRef = useRef<HTMLOListElement>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  const rectsOf = () =>
    Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-stop-li]") ?? []).map((el) => el.getBoundingClientRect());

  const handleProps = (index: number) => ({
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();
      setDrag({ from: index, over: index });
      const onMove = (ev: PointerEvent) => {
        const over = dragTargetIndex(rectsOf(), ev.clientY);
        setDrag((d) => (d ? { ...d, over } : d));
      };
      const finish = (ev: PointerEvent, commit: boolean) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        const to = dragTargetIndex(rectsOf(), ev.clientY);
        setDrag(null);
        if (commit && to !== index) onDrop(index, to);
      };
      const onUp = (ev: PointerEvent) => finish(ev, true);
      const onCancel = (ev: PointerEvent) => finish(ev, false);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    // 끄는 동안 화면이 스크롤되지 않도록
    style: { touchAction: "none" as const },
  });

  return { listRef, drag, handleProps };
}
