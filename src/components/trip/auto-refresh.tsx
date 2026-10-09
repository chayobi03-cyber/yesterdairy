"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 가족이 다른 폰에서 바꾼 진행 상황을 반영한다. 화면이 보일 때만 주기적으로 새로고침하고,
// 입력 중(포커스가 입력창에 있음)에는 건너뛰어 작성 중인 메모를 날리지 않는다.
export function AutoRefresh({ intervalMs = 12000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const tag = document.activeElement?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      router.refresh();
    };
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, intervalMs]);
  return null;
}
