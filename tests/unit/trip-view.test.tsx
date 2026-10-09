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
  deleteTrip: vi.fn(),
}));

import { TripView } from "../../src/app/(app)/trips/[id]/trip-view";

const snapshot = (over: Partial<TripSnapshot> = {}): TripSnapshot => ({
  tripId: "trip-1",
  title: "전주 가족 1박 2일",
  startDate: null,
  def: structuredClone(jeonjuTemplate),
  overrides: {},
  progress: {},
  ...over,
});

const renderView = (initial = snapshot(), isCreator = false) =>
  render(<TripView initial={initial} isCreator={isCreator} initialPlan="balanced" initialDay={1} />);

const stop = (id: string) => screen.getByTestId(`stop-${id}`);
const orderOfStops = () => screen.getAllByTestId(/^stop-/).map((el) => el.getAttribute("data-testid")!.replace("stop-", ""));
const mapStops = () => (h.mapProps.current!.stops as { id: string; number: number }[]);

beforeEach(() => {
  h.mapProps.current = null;
  h.refresh.mockReset();
  h.editDay.mockReset().mockResolvedValue({ ok: true });
  h.updateProgress.mockReset().mockResolvedValue({ ok: true });
  h.addPlace.mockReset().mockResolvedValue({ ok: true });
  Element.prototype.scrollIntoView = vi.fn();
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
    expect(pins.map((p) => p.number)).toEqual(pins.map((_, i) => i + 1)); // 숙소(좌표 없음)는 마지막이라 번호가 비지 않는다
    expect(pins.some((p) => p.id === "d1-stay")).toBe(false);
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

describe("메모/지출 입력", () => {
  it("포커스를 잃으면 저장하고, 바뀌지 않았으면 저장하지 않는다", () => {
    renderView();
    const memo = within(stop("d1-parking")).getByLabelText(/메모/) as HTMLTextAreaElement;
    fireEvent.blur(memo);
    expect(h.updateProgress).not.toHaveBeenCalled();
    fireEvent.change(memo, { target: { value: "주차 B2" } });
    fireEvent.blur(memo);
    expect(h.updateProgress).toHaveBeenCalledWith("trip-1", "d1-parking", { memo: "주차 B2" });
    fireEvent.blur(memo); // 같은 값을 다시 저장하지 않는다
    expect(h.updateProgress).toHaveBeenCalledTimes(1);
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

  it("서버가 새 스냅샷을 보내도 입력 중인 메모는 지우지 않고, 입력 중이 아닌 칸은 가족이 바꾼 값을 따라간다", () => {
    const view = renderView();
    const memo = () => within(stop("d1-parking")).getByLabelText(/메모/) as HTMLTextAreaElement;
    fireEvent.change(memo(), { target: { value: "내가 쓰는 중" } });

    const remote = snapshot({
      progress: { "d1-parking": { item_id: "d1-parking", status: null, checks: {}, memo: "가족이 쓴 메모", cost: 3000, updated_at: "2026-10-09T10:00:00.000Z" } },
    });
    view.rerender(<TripView initial={remote} isCreator={false} initialPlan="balanced" initialDay={1} />);
    expect(memo().value).toBe("내가 쓰는 중"); // 입력 중: 유지
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
    render(<TripView initial={s} isCreator={false} initialPlan="balanced" initialDay={3} />);
    expect(screen.queryByTestId("map")).toBeNull();
    expect(screen.getByText(/지도에 표시할 장소가 아직 없어요/)).toBeTruthy();
  });

  it("대안(균형/체험/여유)을 바꾸면 그 대안의 일정이 보인다", () => {
    renderView();
    fireEvent.change(screen.getByRole("combobox", { name: "여행 대안" }), { target: { value: "experience" } });
    expect(orderOfStops()).toContain("d1-hanok-exp");
    expect(orderOfStops()).not.toContain("d1-snack");
  });
});
