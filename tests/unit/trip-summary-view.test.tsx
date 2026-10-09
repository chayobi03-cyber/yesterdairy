// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jeonjuTemplate } from "../../src/lib/trip/templates/jeonju";
import { TRIP_NOTE_ID } from "../../src/lib/trip/types";
import type { TripSnapshot } from "../../src/lib/trip/view-model";

const h = vi.hoisted(() => ({ refresh: vi.fn(), updateProgress: vi.fn(), deletePhoto: vi.fn(), uploadTripPhoto: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh, push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
vi.mock("@/app/(app)/trips/actions", () => ({
  editDay: vi.fn(), addPlace: vi.fn(), registerPhoto: vi.fn(), deleteTrip: vi.fn(),
  updateProgress: h.updateProgress, deletePhoto: h.deletePhoto,
}));
vi.mock("@/lib/trip/photo-upload", () => ({ uploadTripPhoto: h.uploadTripPhoto }));

import { SummaryView } from "../../src/app/(app)/trips/[id]/summary/summary-view";

const row = (id: string, over = {}) => ({ item_id: id, status: null, checks: {}, memo: "", cost: null, review: "", rating: null, updated_at: "", ...over });
const snapshot = (over: Partial<TripSnapshot> = {}): TripSnapshot => ({
  tripId: "trip-1", title: "전주 가족 1박 2일", startDate: "2026-10-10", def: structuredClone(jeonjuTemplate), overrides: {},
  progress: {
    "d1-parking": row("d1-parking", { status: "done", cost: 14400 }),
    "d1-lunch": row("d1-lunch", { status: "done", cost: 45000, rating: 5, review: "비빔밥이 정말 맛있었어요" }),
    "d1-jeondong": row("d1-jeondong", { status: "arrived", rating: 4 }),
  },
  photos: [{ id: "p1", itemId: "d1-lunch", createdBy: "u1", createdAt: "", url: "https://x/p1.jpg", thumbUrl: "https://x/p1_t.jpg" }],
  ...over,
});
const renderView = (s = snapshot(), isCreator = false) => render(<SummaryView initial={s} plan="balanced" isCreator={isCreator} userId="u1" />);

beforeEach(() => {
  h.refresh.mockReset();
  h.updateProgress.mockReset().mockResolvedValue({ ok: true });
  h.deletePhoto.mockReset().mockResolvedValue({ ok: true });
  window.confirm = vi.fn(() => true);
});
afterEach(cleanup);

describe("여행 요약 화면", () => {
  it("한 줄 요약, 통계, 하이라이트, 날짜별 기록을 보여준다", () => {
    renderView();
    const head = screen.getByTestId("summary-headline").textContent!;
    expect(head).toContain("3곳을 다녀왔어요");
    expect(head).toContain("59,400원");
    expect(head).toContain("가장 좋았던 곳은 전주비빔밥 점심(★★★★★)");
    const stats = screen.getByRole("region", { hidden: true, name: "한 줄 요약" });
    expect(stats).toBeTruthy();
    expect(screen.getByLabelText("여행 통계").textContent).toContain("3/");
    expect(within(screen.getByRole("region", { name: "가장 좋았던 곳" })).getAllByRole("listitem")).toHaveLength(2); // 5점, 4점
    const day1 = screen.getByRole("region", { name: "1일차 기록" });
    expect(day1.textContent).toContain("비빔밥이 정말 맛있었어요");
    expect(within(day1).getByRole("img", { name: "전주비빔밥 점심 사진 1" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "2일차 기록" })).toBeTruthy();
  });

  it("여행 전체 별점과 소감을 남기면 예약 항목(trip-summary)으로 저장된다", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "여행 별점 5점" }));
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", TRIP_NOTE_ID, { rating: 5 });
    const box = screen.getByLabelText(/우리 가족의 한 줄 소감/);
    fireEvent.change(box, { target: { value: "또 가고 싶다" } });
    fireEvent.blur(box);
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", TRIP_NOTE_ID, { review: "또 가고 싶다" });
  });

  it("기록이 없으면 안내 문장을 보여준다", () => {
    renderView(snapshot({ progress: {}, photos: [] }));
    expect(screen.getByTestId("summary-headline").textContent).toContain("아직 다녀온 곳이 없어요");
  });

  it("여행 화면으로 돌아가는 링크가 현재 대안을 유지한다", () => {
    renderView();
    expect(screen.getByRole("link", { name: "여행 화면으로" }).getAttribute("href")).toBe("/trips/trip-1?plan=balanced");
  });
});
