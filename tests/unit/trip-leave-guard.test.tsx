// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { useLeaveGuard, LEAVE_MESSAGE } from "../../src/lib/trip/use-leave-guard";

function Probe({ active }: { active: boolean }) {
  useLeaveGuard(active);
  return (
    <div>
      <a href="/family">가족</a>
      <a href="/trips/1?day=2">같은 페이지</a>
      <a href="https://example.com/x">외부</a>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useLeaveGuard", () => {
  it("저장 대기가 없으면 아무것도 막지 않는다", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByText } = render(<Probe active={false} />);
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    expect(fireEvent.click(getByText("가족"))).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it("저장 대기 중이면 새로고침·탭 닫기에 브라우저 확인창을 띄운다", () => {
    render(<Probe active />);
    const ev = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it("앱 안의 다른 페이지 링크는 확인을 묻고, 취소하면 이동하지 않는다", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByText } = render(<Probe active />);
    const notCancelled = fireEvent.click(getByText("가족"));
    expect(confirm).toHaveBeenCalledWith(LEAVE_MESSAGE);
    expect(notCancelled).toBe(false);
  });

  it("확인하면 이동을 막지 않는다", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { getByText } = render(<Probe active />);
    expect(fireEvent.click(getByText("가족"))).toBe(true);
  });

  it("외부 링크는 가로채지 않는다", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByText } = render(<Probe active />);
    fireEvent.click(getByText("외부"));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("저장이 끝나(active=false) 면 다시 막지 않는다", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const { getByText, rerender } = render(<Probe active />);
    rerender(<Probe active={false} />);
    expect(fireEvent.click(getByText("가족"))).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
