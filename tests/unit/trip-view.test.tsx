// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jeonjuTemplate } from "../../src/lib/trip/templates/jeonju";
import type { TripSnapshot } from "../../src/lib/trip/view-model";

// 지도(Leaflet)와 서버 액션, 라우터는 가짜로 바꾼다. 검증 대상은 화면의 상호작용과 상태 흐름이다.
const h = vi.hoisted(() => ({
  mapProps: { current: null as null | Record<string, unknown> },
  refresh: vi.fn(),
  editDay: vi.fn(),
  updateProgress: vi.fn(),
  addPlace: vi.fn(),
  deletePhoto: vi.fn(),
  uploadTripPhoto: vi.fn(),
  setDayStart: vi.fn(),
  setPlaceLocation: vi.fn(),
  addComment: vi.fn(),
  deleteComment: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () =>
    function MapStub(props: Record<string, unknown>) {
      h.mapProps.current = props;
      return <div data-testid="map" />;
    },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: h.refresh, push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("@/app/(app)/trips/actions", () => ({
  editDay: h.editDay,
  updateProgress: h.updateProgress,
  addPlace: h.addPlace,
  deletePhoto: h.deletePhoto,
  setDayStart: h.setDayStart,
  setPlaceLocation: h.setPlaceLocation,
  addComment: h.addComment,
  deleteComment: h.deleteComment,
  registerPhoto: vi.fn(),
  deleteTrip: vi.fn(),
}));
vi.mock("@/lib/trip/photo-upload", () => ({ uploadTripPhoto: h.uploadTripPhoto }));

import { TripView } from "../../src/app/(app)/trips/[id]/trip-view";

const snapshot = (over: Partial<TripSnapshot> = {}): TripSnapshot => ({
  tripId: "trip-1",
  title: "전주 가족 1박 2일",
  startDate: null,
  def: structuredClone(jeonjuTemplate),
  overrides: {},
  progress: {},
  photos: [],
  comments: [],
  ...over,
});

const renderView = (initial = snapshot(), isCreator = false) =>
  render(<TripView initial={initial} isCreator={isCreator} userId="u1" userName="나" initialPlan="balanced" initialDay={1} />);

const stop = (id: string) => screen.getByTestId(`stop-${id}`);
const orderOfStops = () => screen.getAllByTestId(/^stop-/).map((el) => el.getAttribute("data-testid")!.replace("stop-", ""));
const mapStops = () => (h.mapProps.current!.stops as { id: string; number: number }[]);

beforeEach(() => {
  h.mapProps.current = null;
  h.refresh.mockReset();
  h.editDay.mockReset().mockResolvedValue({ ok: true });
  h.updateProgress.mockReset().mockResolvedValue({ ok: true });
  h.addPlace.mockReset().mockResolvedValue({ ok: true });
  h.deletePhoto.mockReset().mockResolvedValue({ ok: true });
  h.setDayStart.mockReset().mockResolvedValue({ ok: true });
  h.setPlaceLocation.mockReset().mockResolvedValue({ ok: true });
  h.addComment.mockReset().mockResolvedValue({ ok: true });
  h.deleteComment.mockReset().mockResolvedValue({ ok: true });
  h.uploadTripPhoto.mockReset().mockResolvedValue({ ok: true });
  Element.prototype.scrollIntoView = vi.fn();
  window.scrollTo = vi.fn();
  window.confirm = vi.fn(() => true);
});
afterEach(cleanup);

describe("지도와 목록", () => {
  it("순서대로 번호가 붙은 장소 목록과, 같은 번호의 지도 핀을 보여준다", () => {
    renderView();
    const ids = orderOfStops();
    expect(ids.slice(0, 3)).toEqual(["d1-parking", "d1-lunch", "d1-jeondong"]);
    expect(screen.getByTestId("map")).toBeTruthy();
    const pins = mapStops();
    expect(pins[0]).toMatchObject({ id: "d1-parking", number: 1 });
    // 핀 번호는 목록 번호와 같다. 좌표 없는 숙소(6번)는 핀이 없어 번호가 건너뛴다
    expect(pins.map((p) => p.number)).toEqual([1, 2, 3, 4, 5, 7, 8]);
    expect(pins.some((p) => p.id === "d1-stay")).toBe(false);
    expect(screen.getByRole("button", { name: /6\. 숙소 체크인/ })).toBeTruthy();
  });

  it("처음에는 '지금 가야 할 곳'이 첫 장소이고 상세가 열려 있다", () => {
    renderView();
    const now = screen.getByTestId("now-bar");
    expect(within(now).getByText(/1\. 한옥마을 인근 주차/)).toBeTruthy();
    expect(h.mapProps.current!.selectedId).toBe("d1-parking");
    expect(within(stop("d1-parking")).getByRole("region", { name: /한옥마을 인근 주차 상세/ })).toBeTruthy();
  });

  it("장소를 누르면 상세가 열리고 지도 선택이 따라가며, 다시 누르면 닫힌다", () => {
    renderView();
    fireEvent.click(within(stop("d1-jeondong")).getByRole("button", { name: /전동성당 상세 열기/ }));
    expect(h.mapProps.current!.selectedId).toBe("d1-jeondong");
    expect(within(stop("d1-jeondong")).getByRole("region", { name: /전동성당 상세/ })).toBeTruthy();
    expect(within(stop("d1-parking")).queryByRole("region")).toBeNull(); // 한 번에 하나만 열림
    fireEvent.click(within(stop("d1-jeondong")).getByRole("button", { name: /전동성당 상세 닫기/ }));
    expect(h.mapProps.current!.selectedId).toBeNull();
  });

  it("지도 핀을 누르면 그 장소가 선택되고 목록이 그 위치로 스크롤된다", () => {
    renderView();
    const onSelect = h.mapProps.current!.onSelect as (id: string) => void;
    act(() => onSelect("d1-gyeonggijeon"));
    expect(within(stop("d1-gyeonggijeon")).getByRole("region", { name: /경기전 상세/ })).toBeTruthy();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("날짜를 바꾸면 목록과 지도가 함께 바뀌고, 지금 장소는 그 날의 첫 장소", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "2일차" }));
    expect(orderOfStops()[0]).toBe("d2-hyanggyo");
    expect(mapStops()[0].id).toBe("d2-hyanggyo");
    expect(within(screen.getByTestId("now-bar")).getByText(/전주향교/)).toBeTruthy();
    expect(window.location.search).toContain("day=2");
  });

  it("'전체 장소'를 켜면 오늘 일정에 없는 장소가 후보 핀으로 지도에 전달된다", () => {
    renderView();
    expect((h.mapProps.current!.candidates as unknown[]).length).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "전체 장소" }));
    const names = (h.mapProps.current!.candidates as { placeId: string }[]).map((c) => c.placeId);
    expect(names).toContain("hyanggyo");
    expect(names).not.toContain("jeondong");
  });

  it("범례를 누르면 해당 분류의 핀만 지도에 남는다", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "먹거리" }));
    const pins = h.mapProps.current!.stops as { id: string; cat?: string }[];
    expect(pins.length).toBeGreaterThan(0);
    expect(pins.every((p) => p.cat === "food")).toBe(true);
  });

  it("Google 지도 경로 링크는 오늘 장소를 순서대로 담는다", () => {
    renderView();
    const link = screen.getByRole("link", { name: "Google 지도에서 경로 열기" }) as HTMLAnchorElement;
    const q = new URL(link.href).searchParams;
    expect(q.get("origin")).toBeTruthy();
    expect(q.get("destination")).toBeTruthy();
    expect(q.get("travelmode")).toBe("walking");
  });
});

describe("바로 반영 (낙관적 업데이트)", () => {
  it("완료 버튼을 누르면 서버 응답 전에 완료로 보이고 다음 장소가 선택된다", async () => {
    let release!: (v: { ok: true }) => void;
    h.updateProgress.mockReturnValue(new Promise((r) => (release = r)));
    renderView();
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /한옥마을 인근 주차 완료 처리/ }));

    // 서버 응답 전: 이미 반영됨
    expect(within(stop("d1-parking")).getByText("완료")).toBeTruthy();
    expect(within(stop("d1-parking")).getByRole("button", { name: /완료 취소/ }).getAttribute("aria-pressed")).toBe("true");
    expect(h.mapProps.current!.selectedId).toBe("d1-lunch");
    expect(within(screen.getByTestId("now-bar")).getByText(/전주비빔밥 점심/)).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("저장 중");
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", "d1-parking", { status: "done" });

    await act(async () => release({ ok: true }));
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());
  });

  it("완료 버튼을 다시 누르면 완료가 취소된다", () => {
    renderView();
    const btn = () => within(stop("d1-parking")).getByRole("button", { name: /한옥마을 인근 주차 완료/ });
    fireEvent.click(btn());
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /완료 취소/ }));
    expect(h.updateProgress).toHaveBeenLastCalledWith("trip-1", "d1-parking", { status: null });
  });

  it("진행률이 즉시 갱신된다", () => {
    renderView();
    const bar = screen.getByRole("progressbar", { name: "오늘 진행률" });
    expect(bar.getAttribute("aria-valuenow")).toBe("0");
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /완료 처리/ }));
    expect(Number(bar.getAttribute("aria-valuenow"))).toBeGreaterThan(0);
  });

  it("저장이 실패하면 오류를 보여주고 서버 상태로 되돌리려 새로고침한다", async () => {
    h.updateProgress.mockResolvedValue({ ok: false, error: "저장 실패 테스트" });
    renderView();
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /완료 처리/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("저장 실패 테스트");
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });

  it("네트워크 예외도 오류로 알린다", async () => {
    h.updateProgress.mockRejectedValue(new Error("offline"));
    renderView();
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /완료 처리/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("네트워크");
  });

  it("진행 상태 버튼과 체크리스트도 바로 반영된다", () => {
    renderView();
    // 첫 장소는 이미 열려 있다
    fireEvent.click(screen.getByRole("button", { name: "📍 도착" }));
    expect(screen.getByRole("button", { name: "📍 도착" }).getAttribute("aria-pressed")).toBe("true");
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", "d1-parking", { status: "arrived" });
    const check = within(stop("d1-parking")).getAllByRole("checkbox")[0] as HTMLInputElement;
    fireEvent.click(check);
    expect((within(stop("d1-parking")).getAllByRole("checkbox")[0] as HTMLInputElement).checked).toBe(true);
    expect(h.updateProgress).toHaveBeenLastCalledWith("trip-1", "d1-parking", { checkIndex: 0, checked: true });
  });
});

describe("댓글/지출 입력", () => {
  it("댓글을 쓰면 서버 응답 전에 내 이름으로 목록에 보이고 저장하며, 빈 댓글은 보내지 않는다", () => {
    renderView();
    const box = within(stop("d1-parking")).getByLabelText("한옥마을 인근 주차 댓글 쓰기") as HTMLTextAreaElement;
    const send = within(stop("d1-parking")).getByRole("button", { name: "한옥마을 인근 주차 댓글 등록" }) as HTMLButtonElement;
    expect(send.disabled).toBe(true); // 비어 있으면 못 보냄
    fireEvent.change(box, { target: { value: "  주차 B2  " } });
    fireEvent.click(send);
    const item = within(stop("d1-parking")).getByRole("list", { name: "한옥마을 인근 주차 댓글 목록" });
    expect(within(item).getByTestId("comment-author").textContent).toBe("나");
    expect(item.textContent).toContain("주차 B2");
    expect(box.value).toBe(""); // 보낸 뒤 입력칸이 비워진다
    expect(h.addComment).toHaveBeenCalledWith("trip-1", expect.objectContaining({ itemId: "d1-parking", body: "주차 B2" }));
    expect(stop("d1-parking").textContent).toContain("💬 1");
  });

  it("다른 가족의 댓글에는 작성자 이름이 보이고, 지우기는 쓴 사람과 여행을 만든 사람에게만 보인다", () => {
    const comments = [
      { id: "c1", itemId: "d1-parking", body: "내가 쓴 글", createdBy: "u1", authorName: "나", createdAt: "2026-10-10T01:05:00Z" },
      { id: "c2", itemId: "d1-parking", body: "엄마가 쓴 글", createdBy: "u2", authorName: "엄마", createdAt: "2026-10-10T03:30:00Z" },
    ];
    const first = renderView(snapshot({ comments }), false);
    const authors = within(stop("d1-parking")).getAllByTestId("comment-author").map((e) => e.textContent);
    expect(authors).toEqual(["나", "엄마"]);
    expect(stop("d1-parking").textContent).toContain("10/10 10:05"); // 한국 시간(UTC+9)
    expect(within(stop("d1-parking")).queryByRole("button", { name: "나의 댓글 삭제" })).toBeTruthy();
    expect(within(stop("d1-parking")).queryByRole("button", { name: "엄마의 댓글 삭제" })).toBeNull();
    first.unmount();

    renderView(snapshot({ comments }), true);
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: "엄마의 댓글 삭제" }));
    expect(within(stop("d1-parking")).queryByText("엄마가 쓴 글")).toBeNull(); // 바로 사라진다
    expect(h.deleteComment).toHaveBeenCalledWith("trip-1", "c2");
  });

  it("저장에 실패하면 댓글이 사라지고 오류를 알린다", async () => {
    h.addComment.mockResolvedValue({ ok: false, error: "저장 실패" });
    renderView();
    const box = within(stop("d1-parking")).getByLabelText("한옥마을 인근 주차 댓글 쓰기");
    fireEvent.change(box, { target: { value: "곧 사라질 글" } });
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: "한옥마을 인근 주차 댓글 등록" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("저장 실패"));
    expect(h.refresh).toHaveBeenCalled(); // 서버 상태로 되돌린다
  });

  it("댓글 기능 이전의 공용 메모는 '이전 메모'로 보이고 지울 수 있다", () => {
    renderView(snapshot({ progress: { "d1-parking": { item_id: "d1-parking", status: null, checks: {}, memo: "예전에 쓴 메모", cost: null, review: "", rating: null, updated_at: "" } } }));
    expect(stop("d1-parking").textContent).toContain("이전 메모");
    expect(stop("d1-parking").textContent).toContain("예전에 쓴 메모");
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: "한옥마을 인근 주차 이전 메모 지우기" }));
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", "d1-parking", { memo: "" });
  });

  it("지출은 숫자로 저장하고 비우면 null", () => {
    renderView();
    const cost = within(stop("d1-parking")).getByLabelText(/지출/) as HTMLInputElement;
    fireEvent.change(cost, { target: { value: "45000" } });
    fireEvent.blur(cost);
    expect(h.updateProgress).toHaveBeenLastCalledWith("trip-1", "d1-parking", { cost: 45000 });
    fireEvent.change(cost, { target: { value: "" } });
    fireEvent.blur(cost);
    expect(h.updateProgress).toHaveBeenLastCalledWith("trip-1", "d1-parking", { cost: null });
  });

  it("서버가 새 스냅샷을 보내도 쓰는 중인 댓글은 지우지 않고, 입력 중이 아닌 칸은 가족이 바꾼 값을 따라간다", () => {
    const view = renderView();
    const box = () => within(stop("d1-parking")).getByLabelText("한옥마을 인근 주차 댓글 쓰기") as HTMLTextAreaElement;
    fireEvent.change(box(), { target: { value: "내가 쓰는 중" } });

    const remote = snapshot({
      progress: { "d1-parking": { item_id: "d1-parking", status: null, checks: {}, memo: "", cost: 3000, review: "", rating: null, updated_at: "2026-10-09T10:00:00.000Z" } },
      comments: [{ id: "c9", itemId: "d1-parking", body: "가족이 쓴 댓글", createdBy: "u2", authorName: "엄마", createdAt: "2026-10-10T01:00:00Z" }],
    });
    view.rerender(<TripView initial={remote} isCreator={false} userId="u1" userName="나" initialPlan="balanced" initialDay={1} />);
    expect(box().value).toBe("내가 쓰는 중"); // 쓰는 중: 유지
    expect(stop("d1-parking").textContent).toContain("가족이 쓴 댓글"); // 가족이 쓴 댓글이 나타남
    expect((within(stop("d1-parking")).getByLabelText(/지출/) as HTMLInputElement).value).toBe("3000"); // 입력 중 아님: 따라감
  });
});

describe("일정 편집", () => {
  const enterEdit = () => fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));

  it("편집 모드에서 아래로 옮기면 순서가 바로 바뀌고 서버에 저장한다", () => {
    renderView();
    enterEdit();
    const before = orderOfStops();
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: "아래로" }));
    const after = orderOfStops();
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, { type: "move", index: 0, dir: 1 });
    // 지도의 번호/순서도 같이 바뀐다
    expect(mapStops()[0].id).toBe(before[1]);
  });

  it("필수 방문지끼리의 순서 교환은 거부하고 안내한다 (서버 호출 없음)", async () => {
    renderView();
    enterEdit();
    fireEvent.click(within(stop("d1-jeondong")).getByRole("button", { name: "아래로" }));
    expect((await screen.findByRole("alert")).textContent).toContain("필수 방문지끼리의 순서");
    expect(h.editDay).not.toHaveBeenCalled();
  });

  it("필수 방문지에는 삭제 버튼이 없고, 제외할 때는 확인을 받는다", () => {
    renderView();
    enterEdit();
    expect(within(stop("d1-jeondong")).queryByRole("button", { name: "삭제" })).toBeNull();
    expect(within(stop("d1-snack")).getByRole("button", { name: "삭제" })).toBeTruthy();

    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    fireEvent.click(within(stop("d1-jeondong")).getByRole("button", { name: "제외" }));
    expect(h.editDay).not.toHaveBeenCalled();

    fireEvent.click(within(stop("d1-jeondong")).getByRole("button", { name: "제외" }));
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, { type: "toggle", itemId: "d1-jeondong" });
    expect(screen.getByRole("alert").textContent).toContain("필수 방문지가 일정에서 제외돼");
  });

  it("보기 모드에서는 제외된 항목이 숨겨지고 편집 모드에서는 보인다", () => {
    renderView();
    enterEdit();
    fireEvent.click(within(stop("d1-snack")).getByRole("button", { name: "제외" }));
    expect(screen.getByTestId("stop-d1-snack")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "편집 끝내기" }));
    expect(screen.queryByTestId("stop-d1-snack")).toBeNull();
    expect(mapStops().some((p) => p.id === "d1-snack")).toBe(false);
  });

  it("체류시간 조절이 즉시 반영된다", () => {
    renderView();
    enterEdit();
    const before = within(stop("d1-lunch")).getByText(/70분/);
    expect(before).toBeTruthy();
    fireEvent.click(within(stop("d1-lunch")).getByRole("button", { name: "체류시간 10분 증가" }));
    expect(within(stop("d1-lunch")).getByText(/80분/)).toBeTruthy();
  });

  it("장소 없는 일정을 추가하면 서버와 같은 id로 바로 나타난다", () => {
    renderView();
    enterEdit();
    fireEvent.change(screen.getByLabelText("일정 이름"), { target: { value: "카페 휴식" } });
    fireEvent.click(screen.getByRole("button", { name: "장소 없는 일정 추가" }));
    const op = h.editDay.mock.calls.at(-1)![3] as { type: string; title: string; id: string };
    expect(op).toMatchObject({ type: "addRest", title: "카페 휴식" });
    expect(screen.getByTestId(`stop-${op.id}`)).toBeTruthy();
  });

  it("내 장소를 만들면 일정과 지도에 바로 들어가고, 잘못된 좌표는 거부한다", async () => {
    renderView();
    enterEdit();
    fireEvent.click(screen.getByRole("button", { name: "+ 내 장소 만들기" }));
    const form = screen.getByRole("form", { name: "내 장소 만들기" });
    fireEvent.change(within(form).getByLabelText("장소 이름"), { target: { value: "<b>새 카페</b>" } });
    fireEvent.change(within(form).getByLabelText("위도"), { target: { value: "95" } });
    fireEvent.change(within(form).getByLabelText("경도"), { target: { value: "127.1" } });
    fireEvent.submit(form);
    expect((await screen.findByRole("alert")).textContent).toContain("좌표가 올바르지 않아요");
    expect(h.addPlace).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByLabelText("위도"), { target: { value: "35.81" } });
    fireEvent.submit(form);
    await waitFor(() => expect(h.addPlace).toHaveBeenCalled());
    const [, input] = h.addPlace.mock.calls[0];
    expect(input).toMatchObject({ name: "<b>새 카페</b>", planId: "balanced", day: 1, addNow: true });
    const added = screen.getByTestId(`stop-${input.itemId}`);
    expect(added.textContent).toContain("<b>새 카페</b>"); // 태그로 해석되지 않고 글자 그대로
    expect(added.querySelector("b")).toBeNull();
    expect(mapStops().some((p) => p.id === input.itemId)).toBe(true);
  });

  it("지도의 '오늘 일정에 추가'는 후보 장소를 일정 끝에 넣는다", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "전체 장소" }));
    const onAdd = h.mapProps.current!.onAdd as (placeId: string) => void;
    act(() => onAdd("hyanggyo"));
    const op = h.editDay.mock.calls.at(-1)![3] as { type: string; placeId: string; id: string };
    expect(op).toMatchObject({ type: "add", placeId: "hyanggyo" });
    expect(screen.getByTestId(`stop-${op.id}`)).toBeTruthy();
    expect((h.mapProps.current!.candidates as { placeId: string }[]).some((c) => c.placeId === "hyanggyo")).toBe(false);
  });

  it("편집 실패 시 오류를 보여주고 새로고침한다", async () => {
    h.editDay.mockResolvedValue({ ok: false, error: "다른 가족이 동시에 수정하고 있어요" });
    renderView();
    enterEdit();
    fireEvent.click(within(stop("d1-snack")).getByRole("button", { name: "제외" }));
    expect((await screen.findByRole("alert", {}, { timeout: 2000 })).textContent).toContain("동시에 수정");
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
  });
});

describe("드래그로 순서 바꾸기", () => {
  // jsdom에는 레이아웃이 없으므로 각 칸이 위에서부터 100px씩 차지하는 것처럼 꾸민다
  const fakeLayout = () => {
    const lis = Array.from(document.querySelectorAll<HTMLElement>("[data-stop-li]"));
    lis.forEach((li, i) => {
      li.getBoundingClientRect = () => ({ top: i * 100, bottom: i * 100 + 100, left: 0, right: 300, width: 300, height: 100, x: 0, y: i * 100, toJSON: () => ({}) });
    });
  };
  const move = (type: "pointermove" | "pointerup", clientY: number) => act(() => { window.dispatchEvent(new MouseEvent(type, { clientY })); });

  it("손잡이를 끌어 놓으면 그 위치로 옮기고 서버에 한 번만 저장한다", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));
    fakeLayout();
    const before = orderOfStops();
    const handle = within(stop("d1-dinner")).getByRole("button", { name: /순서 끌어서 바꾸기/ });
    fireEvent.pointerDown(handle, { button: 0 });
    move("pointermove", 450); // 5번째 칸 중간 아래
    move("pointerup", 120);   // 2번째 칸(index 1)의 위쪽 절반에 놓기
    const after = orderOfStops();
    expect(after.indexOf("d1-dinner")).toBe(1);
    expect(after).toHaveLength(before.length);
    expect(h.editDay).toHaveBeenCalledTimes(1);
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, { type: "moveTo", from: before.indexOf("d1-dinner"), to: 1 });
    expect(mapStops().findIndex((p) => p.id === "d1-dinner")).toBeLessThan(mapStops().findIndex((p) => p.id === "d1-gyeonggijeon"));
  });

  it("제자리에 놓거나 취소하면 저장하지 않는다", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));
    fakeLayout();
    const handle = () => within(stop("d1-lunch")).getByRole("button", { name: /순서 끌어서 바꾸기/ });
    fireEvent.pointerDown(handle(), { button: 0 });
    move("pointerup", 120); // lunch는 index 1 -> 같은 칸
    expect(h.editDay).not.toHaveBeenCalled();
    fireEvent.pointerDown(handle(), { button: 0 });
    act(() => { window.dispatchEvent(new MouseEvent("pointercancel", { clientY: 450 })); });
    expect(h.editDay).not.toHaveBeenCalled();
  });

  it("필수 방문지를 다른 필수 방문지 위로 끌어 넘기면 거부하고 안내한다", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));
    fakeLayout();
    const ids = orderOfStops();
    const from = ids.indexOf("d1-jeondong");
    fireEvent.pointerDown(within(stop("d1-jeondong")).getByRole("button", { name: /순서 끌어서 바꾸기/ }), { button: 0 });
    move("pointerup", (ids.indexOf("d1-gyeonggijeon") + 1) * 100 - 10); // 경기전(필수) 뒤로
    expect((await screen.findByRole("alert")).textContent).toContain("필수 방문지끼리의 순서");
    expect(orderOfStops().indexOf("d1-jeondong")).toBe(from);
    expect(h.editDay).not.toHaveBeenCalled();
  });
});

describe("기타", () => {
  it("만든 사람에게만 삭제 버튼이 보인다", () => {
    renderView(snapshot(), false);
    expect(screen.queryByRole("button", { name: "이 여행 삭제" })).toBeNull();
    cleanup();
    renderView(snapshot(), true);
    expect(screen.getByRole("button", { name: "이 여행 삭제" })).toBeTruthy();
  });

  it("좌표가 하나도 없는 날은 지도 대신 안내를 보여준다", () => {
    const s = snapshot();
    s.def.days.push({ n: 3, label: "3일차", start: "10:00" });
    s.def.plans.balanced.days["3"] = [{ id: "d3-rest", rest: "집에서 쉬기" }];
    render(<TripView initial={s} isCreator={false} userId="u1" userName="나" initialPlan="balanced" initialDay={3} />);
    expect(screen.queryByTestId("map")).toBeNull();
    expect(screen.getByText(/지도에 표시할 장소가 아직 없어요/)).toBeTruthy();
  });

  it("대안(균형/체험/여유)을 바꾸면 그 대안의 일정이 보인다", () => {
    renderView();
    fireEvent.change(screen.getByRole("combobox", { name: "여행 대안" }), { target: { value: "experience" } });
    expect(orderOfStops()).toContain("d1-hanok-exp");
    expect(orderOfStops()).not.toContain("d1-hanok-walk");
  });
});

describe("고정 시작 시각", () => {
  it("편집 모드에서 시각을 지정하면 카드와 하루 요약에 대기 시간이 나타나고, 해제하면 사라진다", () => {
    renderView();
    // 기본 일정에서 저녁은 17:30 고정이라 이미 대기가 있다
    expect(screen.getByTestId("day-summary").textContent).toContain("대기");
    fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));
    const input = screen.getByLabelText("저녁 식사 고정 시작 시각") as HTMLInputElement;
    expect(input.value).toBe("17:30");
    fireEvent.change(input, { target: { value: "19:00" } });
    expect((screen.getByLabelText("저녁 식사 고정 시작 시각") as HTMLInputElement).value).toBe("19:00");
    expect(screen.getByTestId("stop-d1-dinner").textContent).toContain("19:00");
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, { type: "setAt", itemId: "d1-dinner", at: "19:00" });

    fireEvent.click(screen.getByRole("button", { name: "저녁 식사 고정 시각 해제" }));
    expect(screen.queryByRole("button", { name: "저녁 식사 고정 시각 해제" })).toBeNull();
  });

  it("고정 시각보다 늦게 도착하는 항목에는 '늦음'이 표시된다", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));
    // 점심을 길게 늘려 저녁(17:30 고정)을 확실히 넘긴다
    for (let i = 0; i < 40; i++) fireEvent.click(within(screen.getByTestId("stop-d1-lunch")).getByRole("button", { name: "체류시간 10분 증가" }));
    expect(screen.getByTestId("stop-d1-dinner").textContent).toMatch(/예정 17:30보다 \d+분 늦음/);
  });
});

describe("소감과 사진", () => {
  const withDone = (extra: Partial<TripSnapshot> = {}) =>
    snapshot({
      progress: { "d1-parking": { item_id: "d1-parking", status: "done", checks: {}, memo: "", cost: null, review: "", rating: null, updated_at: "" } },
      ...extra,
    });
  const photo = (id: string, itemId: string | null, createdBy = "u1") => ({
    id, itemId, createdBy, authorName: createdBy === "u1" ? "나" : "엄마", createdAt: "2026-10-10T00:00:00Z", url: `https://x/${id}.jpg`, thumbUrl: `https://x/${id}_t.jpg`,
  });

  it("다녀온 장소(도착/완료)에서만 소감 영역이 보이고, 별점을 누르면 바로 반영되고 저장된다", () => {
    // 아직 방문 전인 첫 장소에는 소감이 없다
    const { unmount } = renderView();
    expect(screen.queryByRole("region", { name: /소감/ })).toBeNull();
    unmount();

    renderView(withDone());
    // 완료된 주차 장소를 열어서 소감을 남긴다
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /상세 열기/ }));
    const review = screen.getByRole("region", { name: "한옥마을 인근 주차 소감" });
    fireEvent.click(within(review).getByRole("button", { name: "별점 4점" }));
    expect(within(review).getByRole("button", { name: "별점 4점" }).getAttribute("aria-pressed")).toBe("true");
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", "d1-parking", { rating: 4 });
    // 목록 카드에도 별이 보인다
    expect(stop("d1-parking").textContent).toContain("★★★★");
    // 같은 별을 다시 누르면 지운다
    fireEvent.click(within(review).getByRole("button", { name: "별점 4점" }));
    expect(h.updateProgress).toHaveBeenLastCalledWith("trip-1", "d1-parking", { rating: null });
  });

  it("소감 글은 입력을 마치면(blur) 저장된다", () => {
    renderView(withDone());
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /상세 열기/ }));
    const box = screen.getByLabelText(/소감 \(가족 모두에게 보여요\)/);
    fireEvent.change(box, { target: { value: "주차가 편했어요" } });
    fireEvent.blur(box);
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", "d1-parking", { review: "주차가 편했어요" });
  });

  it("장소별 사진이 보이고, 지우기는 올린 사람과 여행을 만든 사람에게만 보인다", () => {
    const s = withDone({ photos: [photo("p1", "d1-parking", "u1"), photo("p2", "d1-parking", "other"), photo("p3", "d1-lunch")] });
    const first = renderView(s, false);
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /상세 열기/ }));
    expect(within(stop("d1-parking")).getAllByRole("img")).toHaveLength(2); // 이 장소의 사진만
    expect(stop("d1-parking").textContent).toContain("📷 2");

    // 내가(u1) 올린 사진: 삭제 가능
    fireEvent.click(screen.getByRole("button", { name: "한옥마을 인근 주차 사진 1 크게 보기" }));
    expect(screen.getByRole("button", { name: "삭제" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "사진 닫기" }));
    // 다른 사람이 올린 사진: 만든 사람이 아니면 삭제 버튼이 없다
    fireEvent.click(screen.getByRole("button", { name: "한옥마을 인근 주차 사진 2 크게 보기" }));
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
    first.unmount();

    // 여행을 만든 사람은 다른 사람의 사진도 지울 수 있다
    renderView(s, true);
    fireEvent.click(within(stop("d1-parking")).getByRole("button", { name: /상세 열기/ }));
    fireEvent.click(screen.getByRole("button", { name: "한옥마을 인근 주차 사진 2 크게 보기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(within(stop("d1-parking")).getAllByRole("img")).toHaveLength(1); // 바로 사라진다
    expect(h.deletePhoto).toHaveBeenCalledWith("trip-1", "p2");
  });

  it("사진을 고르면 한 장씩 올리고, 끝나면 서버 상태를 다시 받는다", async () => {
    renderView();
    const input = screen.getByLabelText("한옥마을 인근 주차 사진 선택") as HTMLInputElement;
    const files = [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.png", { type: "image/png" })];
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });
    await waitFor(() => expect(h.uploadTripPhoto).toHaveBeenCalledTimes(2));
    expect(h.uploadTripPhoto).toHaveBeenNthCalledWith(1, "trip-1", "d1-parking", files[0]);
    expect(h.refresh).toHaveBeenCalled();
  });

  it("한 곳의 사진이 12장이면 더 올릴 수 없고 이유를 알려준다", async () => {
    const full = Array.from({ length: 12 }, (_, i) => photo(`p${i}`, "d1-parking"));
    renderView(snapshot({ photos: full }));
    const input = screen.getByLabelText("한옥마을 인근 주차 사진 선택") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" })] } });
    });
    expect(h.uploadTripPhoto).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("12장");
  });

  it("업로드 실패 메시지를 보여준다", async () => {
    h.uploadTripPhoto.mockResolvedValue({ ok: false, error: "사진을 올리지 못했어요." });
    renderView();
    const input = screen.getByLabelText("한옥마을 인근 주차 사진 선택") as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { files: [new File(["a"], "a.jpg", { type: "image/jpeg" })] } });
    });
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("사진을 올리지 못했어요"));
  });
});

describe("시간·블록 편집", () => {
  const enter = () => fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));

  it("하루 출발 시각을 바꾸면 첫 일정 시각이 바로 따라가고 저장된다", () => {
    renderView();
    expect(screen.queryByLabelText("1일차 출발 시각")).toBeNull(); // 편집 모드에서만
    enter();
    const input = screen.getByLabelText("1일차 출발 시각") as HTMLInputElement;
    expect(input.value).toBe("11:30");
    fireEvent.change(input, { target: { value: "09:00" } });
    expect((screen.getByLabelText("1일차 출발 시각") as HTMLInputElement).value).toBe("09:00");
    expect(stop("d1-parking").textContent).toContain("09:00–09:20");
    expect(h.setDayStart).toHaveBeenCalledWith("trip-1", 1, "09:00");
  });

  it("체류시간을 분 단위로 직접 입력하고 입력을 마치면 저장된다", () => {
    renderView();
    enter();
    const input = screen.getByLabelText("한옥마을 인근 주차 체류시간(분)") as HTMLInputElement;
    expect(input.value).toBe("20");
    fireEvent.change(input, { target: { value: "193" } });
    expect(h.editDay).not.toHaveBeenCalled(); // 입력 중에는 저장하지 않는다
    fireEvent.blur(input);
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, { type: "setDur", itemId: "d1-parking", dur: 193 });
    expect(stop("d1-parking").textContent).toContain("193분");
  });

  it("범위를 벗어난 체류시간은 오류를 알리고 반영하지 않는다", () => {
    renderView();
    enter();
    const input = screen.getByLabelText("한옥마을 인근 주차 체류시간(분)");
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toContain("5~600분");
    expect(stop("d1-parking").textContent).toContain("20분");
  });

  it("블록의 장소를 바꾸면 그 자리에서 이름과 시간이 바뀐다 (필수 방문지는 잠김)", () => {
    renderView();
    enter();
    const sel = screen.getByLabelText("초코파이·길거리 간식 장소 바꾸기") as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: "cafe" } });
    expect(stop("d1-snack").textContent).toContain("한옥 카페 휴식");
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, { type: "setPlace", itemId: "d1-snack", placeId: "cafe" });
    expect((screen.getByLabelText("전동성당 장소 바꾸기") as HTMLSelectElement).disabled).toBe(true);
  });

  it("장소 없는 일정은 이름을 바꿀 수 있다", () => {
    renderView();
    enter();
    fireEvent.change(screen.getByLabelText("일정 이름"), { target: { value: "휴게소 들르기" } });
    fireEvent.click(screen.getByRole("button", { name: "장소 없는 일정 추가" }));
    const nameInput = screen.getByLabelText("휴게소 들르기 이름") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "운전 이동" } });
    fireEvent.blur(nameInput);
    expect(screen.getByText("운전 이동", { selector: "span" })).toBeTruthy();
    const call = h.editDay.mock.calls.find((c) => c[3]?.type === "rename");
    expect(call?.[3]).toMatchObject({ type: "rename", title: "운전 이동" });
  });
});

describe("지도 위치 지정", () => {
  const pickProps = () => h.mapProps.current as { picking: boolean; pickPoint: [number, number] | null; onPickPoint: (lat: number, lon: number) => void };

  it("좌표가 없어 지도에 안 나오는 장소를 알려주고, 누르면 위치 지정 모드가 된다", () => {
    renderView();
    const group = screen.getByRole("group", { name: "지도에 없는 장소" });
    expect(within(group).getByRole("button", { name: "숙소 체크인 위치 지정" })).toBeTruthy();
    expect(pickProps().picking).toBe(false);
    fireEvent.click(within(group).getByRole("button", { name: "숙소 체크인 위치 지정" }));
    expect(screen.getByRole("region", { name: "위치 지정" }).textContent).toContain("숙소 체크인");
    expect(pickProps().picking).toBe(true);
    expect((screen.getByRole("button", { name: "여기로 저장" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("지도를 눌러 정한 위치를 저장하면 핀이 바로 생기고 서버에도 저장된다", async () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "숙소 체크인 위치 지정" }));
    act(() => pickProps().onPickPoint(35.81234567, 127.15111111));
    expect(pickProps().pickPoint).toEqual([35.81234567, 127.15111111]);
    fireEvent.click(screen.getByRole("button", { name: "여기로 저장" }));
    // 낙관적 반영: 모드가 끝나고 숙소 핀(6번)이 지도에 생긴다
    expect(pickProps().picking).toBe(false);
    expect(mapStops().some((p) => p.id === "d1-stay" && p.number === 6)).toBe(true);
    expect(screen.queryByRole("group", { name: "지도에 없는 장소" })).toBeNull();
    await waitFor(() => expect(h.setPlaceLocation).toHaveBeenCalledWith("trip-1", "stay", { lat: 35.81234567, lon: 127.15111111 }));
  });

  it("취소하면 아무것도 저장하지 않는다", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "숙소 체크인 위치 지정" }));
    act(() => pickProps().onPickPoint(35.8, 127.1));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(pickProps().picking).toBe(false);
    expect(h.setPlaceLocation).not.toHaveBeenCalled();
    expect(mapStops().some((p) => p.id === "d1-stay")).toBe(false);
  });

  it("편집 모드에서 이미 지도에 있는 장소의 위치도 고칠 수 있다 (현재 위치에서 시작)", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));
    fireEvent.click(screen.getByRole("button", { name: "전동성당 지도 위치 수정" }));
    expect(pickProps().picking).toBe(true);
    expect(pickProps().pickPoint).toEqual([35.8133, 127.1497]);
  });

  it("저장이 실패하면 오류를 알리고 서버 상태로 되돌린다", async () => {
    h.setPlaceLocation.mockResolvedValue({ ok: false, error: "저장 실패" });
    renderView();
    fireEvent.click(screen.getByRole("button", { name: "숙소 체크인 위치 지정" }));
    act(() => pickProps().onPickPoint(35.8, 127.1));
    fireEvent.click(screen.getByRole("button", { name: "여기로 저장" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("저장 실패"));
    expect(h.refresh).toHaveBeenCalled();
  });
});

describe("추가·순서 바꾸기 (맨 아래로 붙지 않게)", () => {
  const enter = () => fireEvent.click(screen.getByRole("button", { name: "일정 편집" }));

  it("새 장소는 '지금 가야 할 곳' 바로 다음에 들어가고, 열려서 보인다", () => {
    renderView();
    enter();
    const before = orderOfStops();
    expect((screen.getByLabelText("넣을 위치") as HTMLSelectElement).value).toBe("1"); // 1번(주차) 다음
    fireEvent.change(screen.getByLabelText("추가할 장소"), { target: { value: "cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "선택한 장소를 일정에 추가" }));
    const after = orderOfStops();
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toBe(before[0]);
    expect(after[2]).toBe(before[1]);
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, expect.objectContaining({ type: "add", placeId: "cafe", index: 1 }));
    // 방금 넣은 항목의 상세가 열려 있다
    const newId = after[1];
    expect(within(stop(newId)).getByRole("region", { name: /상세/ })).toBeTruthy();
  });

  it("넣을 위치를 직접 고를 수 있다 (맨 처음 / 특정 장소 다음)", () => {
    renderView();
    enter();
    fireEvent.change(screen.getByLabelText("넣을 위치"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("추가할 장소"), { target: { value: "cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "선택한 장소를 일정에 추가" }));
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, expect.objectContaining({ type: "add", placeId: "cafe", index: 0 }));
    expect(mapStops().length).toBeGreaterThan(0);
  });

  it("장소 없는 일정도 같은 위치 선택을 따른다", () => {
    renderView();
    enter();
    fireEvent.change(screen.getByLabelText("넣을 위치"), { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("일정 이름"), { target: { value: "휴식" } });
    fireEvent.click(screen.getByRole("button", { name: "장소 없는 일정 추가" }));
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, expect.objectContaining({ type: "addRest", title: "휴식", index: 3 }));
    expect(orderOfStops()[3]).not.toMatch(/^d1-/);
  });

  it("카드의 '순서' 선택으로 원하는 자리까지 한 번에 옮긴다", () => {
    renderView();
    enter();
    const ids = orderOfStops();
    const from = ids.indexOf("d1-snack");
    fireEvent.change(screen.getByLabelText("초코파이·길거리 간식 순서 바꾸기"), { target: { value: "1" } });
    expect(orderOfStops()[1]).toBe("d1-snack");
    expect(h.editDay).toHaveBeenCalledWith("trip-1", "balanced", 1, { type: "moveTo", from, to: 1 });
  });

  it("필수 방문지를 넘어서는 이동은 거부하고 안내한다", async () => {
    renderView();
    enter();
    // 전동성당(필수)과 경기전(필수) 사이로는 못 들어가는 게 아니라, 필수끼리 추월만 막는다
    fireEvent.change(screen.getByLabelText("전동성당 순서 바꾸기"), { target: { value: "5" } });
    expect((await screen.findByRole("alert")).textContent).toContain("필수 방문지끼리의 순서");
    expect(h.editDay).not.toHaveBeenCalled();
  });
});
