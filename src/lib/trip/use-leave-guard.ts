"use client";

import { useEffect } from "react";

export const LEAVE_MESSAGE = "아직 저장 중인 변경이 있어요. 지금 나가면 일부가 저장되지 않을 수 있어요. 그래도 나갈까요?";

// 저장이 끝나지 않은 변경이 있으면 페이지를 떠나기 전에 한 번 물어본다.
// - 탭 닫기·새로고침·주소 직접 이동: 브라우저 기본 확인창(beforeunload)
// - 앱 안의 링크(탭바·뒤로가기 링크 등): 클릭을 가로채 확인창을 띄운다 (Next 라우팅은 beforeunload를 안 거친다)
export function useLeaveGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (a.target && a.target !== "_self") return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // 외부 링크는 beforeunload가 처리
      // 같은 페이지 안에서 쿼리만 바꾸는 이동(?day, ?plan 등)은 저장 대기 중인 요청을 끊지 않는다
      if (url.pathname === window.location.pathname) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);
}
