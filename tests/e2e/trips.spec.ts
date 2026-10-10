import { test, expect, type Page, type Response } from "@playwright/test";

// 가족 여행 플래너: 한 사람이 템플릿으로 여행을 만들고, 한 화면에서 지도와 장소 목록을 오가며
// 장소별로 진행 기록을 남기면, 같은 가족의 두 번째 구성원이 그 기록을 그대로 본다.
// 다른 가족은 그 여행을 볼 수 없다. (RLS는 가족 범위로 공유한다)
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_trip_${runId}`;
const username2 = `e2e_trip_${runId}_2`;
const outsider = `e2e_trip_${runId}_x`;
const password = "TestPass123!";

// 화면은 보고 있는 대안/날짜를 주소창(?plan=&day=)에 남기므로 쿼리를 허용한다
const TRIP_URL = /\/trips\/[0-9a-f-]{36}(\?.*)?$/;

test.describe.configure({ mode: "serial" });
// 클릭/입력이 없는 요소를 무한정 기다리다 테스트 전체 타임아웃으로만 터지지 않게 한다
// (원인 스텝이 로그에 남도록).
test.use({ actionTimeout: 15_000 });

function makeStep(page: Page) {
  return async (name: string, expectUrl: RegExp, run: () => Promise<void>) => {
    await test.step(name, async () => {
      await run();
      await expect(page).toHaveURL(expectUrl);
    });
  };
}

async function signUp(page: Page, name: string) {
  await page.goto("/signup");
  await page.getByPlaceholder("아이디 (로그인용)").fill(name);
  await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding");
}

// 1x1 투명이 아닌 작은 PNG (브라우저가 디코드해서 JPEG로 줄여 올린다)
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const pins = (page: Page) => page.locator(".leaflet-marker-icon");
const stop = (page: Page, id: string) => page.getByTestId(`stop-${id}`);
const stopOrder = (page: Page) => page.getByTestId(/^stop-/).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.testid!.replace("stop-", "")));
const openEdit = async (page: Page) => {
  if ((await page.getByRole("button", { name: "일정 편집" }).count()) > 0) await page.getByRole("button", { name: "일정 편집" }).click();
};

// 저장은 서버 액션 POST로 나간다. 응답 수를 세어 저장이 끝났는지 판단한다
// (networkidle은 링크 프리페치/주기적 동기화 때문에 끝나지 않는다).
function countServerActions(page: Page) {
  const state = { n: 0 };
  const onResponse = (r: Response) => {
    if (r.request().method() === "POST" && r.request().headers()["next-action"]) state.n++;
  };
  page.on("response", onResponse);
  return { state, stop: () => page.off("response", onResponse) };
}

test("family trip: map + ordered stops on one page, instant edits, shared with family only", async ({ page, browser }) => {
  // 저장 중에 페이지를 떠나면 앱이 확인창을 띄운다(use-leave-guard). 테스트는 이동을 계속해야 하므로 수락한다.
  page.on("dialog", (d) => {
    if (d.type() === "beforeunload" || d.message().includes("저장 중인 변경")) void d.accept();
  });
  // 시나리오가 길다(가입 2명 + 지도/목록/편집/동시 편집/삭제, 모두 실제 Supabase 왕복).
  // 전역 90초보다 넉넉히 잡는다.
  test.setTimeout(150_000);
  const step = makeStep(page);
  let inviteCode = "";
  let tripUrl = "";

  await step("sign up and create a family", /\/$/, async () => {
    await signUp(page, username);
    await page.getByRole("button", { name: "새 가족 만들기" }).click();
    await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(`E2E 여행 가족 ${runId}`);
    await page.getByRole("button", { name: "가족 만들기" }).click();
    await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });
  });

  await step("home links to the trips screen", /\/trips$/, async () => {
    await page.getByRole("link", { name: /가족 여행/ }).click();
    await page.waitForURL("**/trips");
    await expect(page.getByText("아직 여행이 없어요")).toBeVisible();
  });

  await step("create a trip from the Jeonju template", TRIP_URL, async () => {
    await page.getByRole("button", { name: "+ 새 여행 만들기" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();
    await page.waitForURL(TRIP_URL);
    tripUrl = page.url().split("?")[0];
    await expect(page.getByRole("heading", { name: "전주 가족 1박 2일" })).toBeVisible();
  });

  await step("one page: map pins and the ordered list share the same numbers", TRIP_URL, async () => {
    await expect(page.getByRole("region", { name: "여행 지도" })).toBeVisible();
    // 1일차: 좌표가 있는 7곳이 지도에 번호 핀으로 (숙소는 좌표가 없어 목록에만 있다)
    await expect(pins(page)).toHaveCount(7);
    await expect(page.getByTitle("1. 한옥마을 인근 주차")).toBeVisible();
    await expect(page.getByTitle("3. 전동성당")).toBeVisible();
    await expect(page.getByTestId("now-bar")).toContainText("1. 한옥마을 인근 주차");
    expect((await stopOrder(page)).slice(0, 3)).toEqual(["d1-parking", "d1-lunch", "d1-jeondong"]);
    // 지도 도구: 경로 열기 링크는 Google 지도로
    await expect(page.getByRole("link", { name: "Google 지도에서 경로 열기" })).toHaveAttribute("href", /google\.com\/maps\/dir/);
  });

  const actions = countServerActions(page);

  await step("complete a stop with one tap: instant, moves on to the next stop", TRIP_URL, async () => {
    await page.getByRole("button", { name: "한옥마을 인근 주차 완료 처리" }).click();
    // 서버 응답을 기다리지 않고 바로 반영된다
    await expect(page.getByRole("button", { name: "한옥마을 인근 주차 완료 취소" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("now-bar")).toContainText("2. 전주비빔밥 점심");
    await expect(page.getByTitle("1. 한옥마을 인근 주차")).toHaveText("✓");
    await expect(page.getByRole("region", { name: "전주비빔밥 점심 상세" })).toBeVisible();
  });

  await step("check-list, comment, cost and status are saved", TRIP_URL, async () => {
    const detail = page.getByRole("region", { name: "전주비빔밥 점심 상세" });
    await detail.getByRole("checkbox").first().check();
    // 메모는 작성자와 시각이 남는 댓글이다
    await detail.getByLabel("전주비빔밥 점심 댓글 쓰기").fill(`예약 완료 ${runId}`);
    await detail.getByRole("button", { name: "전주비빔밥 점심 댓글 등록" }).click();
    await expect(detail.getByRole("list", { name: "전주비빔밥 점심 댓글 목록" })).toContainText(`예약 완료 ${runId}`);
    await detail.getByLabel(/지출/).fill("45000");
    await detail.getByLabel(/지출/).blur();
    await detail.getByRole("button", { name: "📍 도착" }).click();
    await expect(detail.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true");
    // 연달아 누른 저장 요청(완료, 체크, 댓글, 지출, 상태)이 모두 끝날 때까지 기다린 뒤 새로고침한다
    await expect.poll(() => actions.state.n, { timeout: 20_000 }).toBeGreaterThanOrEqual(5);
    actions.stop();
    await expect(page.getByText("저장 중…")).toHaveCount(0);
    await expect(async () => {
      await page.reload();
      const d = page.getByRole("region", { name: "전주비빔밥 점심 상세" });
      const list = d.getByRole("list", { name: "전주비빔밥 점심 댓글 목록" });
      await expect(list).toContainText(`예약 완료 ${runId}`, { timeout: 2_000 });
      await expect(list.getByTestId("comment-author").first()).not.toBeEmpty({ timeout: 2_000 }); // 쓴 사람 이름
      await expect(d.getByRole("checkbox").first()).toBeChecked({ timeout: 2_000 });
      await expect(d.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
      await expect(page.getByRole("button", { name: "한옥마을 인근 주차 완료 취소" })).toBeVisible({ timeout: 2_000 });
      await expect(page.getByText("누적 지출 기록 45,000원")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  });

  await step("review, rating and photo are saved and shown in the trip summary", TRIP_URL, async () => {
    const detail = page.getByRole("region", { name: "전주비빔밥 점심 상세" });
    const review = detail.getByRole("region", { name: "전주비빔밥 점심 소감" });
    await review.getByRole("button", { name: "별점 5점" }).click();
    await review.getByLabel(/소감 \(가족 모두에게 보여요\)/).fill(`비빔밥이 맛있었어요 ${runId}`);
    await review.getByLabel(/소감 \(가족 모두에게 보여요\)/).blur();
    await detail.getByLabel("전주비빔밥 점심 사진 선택").setInputFiles({ name: "lunch.png", mimeType: "image/png", buffer: PNG_1X1 });
    // 업로드(브라우저 → Storage) + 메타데이터 저장 + 서버 상태 재조회가 끝나면 썸네일이 나타난다
    await expect(detail.getByRole("img", { name: "전주비빔밥 점심 사진 1" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("저장 중…")).toHaveCount(0);
    await expect(async () => {
      await page.reload();
      const d = page.getByRole("region", { name: "전주비빔밥 점심 상세" });
      await expect(d.getByLabel(/소감 \(가족 모두에게 보여요\)/)).toHaveValue(`비빔밥이 맛있었어요 ${runId}`, { timeout: 2_000 });
      await expect(d.getByRole("button", { name: "별점 5점" })).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
      await expect(d.getByRole("img", { name: "전주비빔밥 점심 사진 1" })).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });

    // 여행 요약: 한 줄 요약, 소감, 사진이 모인다
    await page.getByRole("link", { name: "여행 요약" }).click();
    await page.waitForURL(/\/trips\/[0-9a-f-]{36}\/summary/);
    await expect(page.getByTestId("summary-headline")).toContainText("다녀왔어요");
    await expect(page.getByTestId("summary-headline")).toContainText("45,000원");
    const day1 = page.getByRole("region", { name: "1일차 기록" });
    await expect(day1).toContainText(`비빔밥이 맛있었어요 ${runId}`);
    await expect(day1.getByRole("img", { name: "전주비빔밥 점심 사진 1" })).toBeVisible();
    await page.getByRole("button", { name: "여행 별점 4점" }).click();
    await page.getByRole("link", { name: "여행 화면으로" }).click();
    await page.waitForURL(TRIP_URL);
  });

  await step("tapping a map pin selects that stop in the list", TRIP_URL, async () => {
    // 가까운 핀끼리 겹칠 수 있어 실제 클릭 대신 핀 요소에 클릭 이벤트를 보낸다
    await page.getByTitle("3. 전동성당").dispatchEvent("click");
    await expect(page.getByRole("region", { name: "전동성당 상세" })).toBeVisible();
    await expect(page.getByRole("region", { name: "전주비빔밥 점심 상세" })).toHaveCount(0);
    // 목록에서 다른 장소를 누르면 그쪽으로
    await stop(page, "d1-gyeonggijeon").getByRole("button", { name: /상세 열기/ }).click();
    await expect(page.getByRole("region", { name: "경기전 상세" })).toBeVisible();
  });

  await step("day and plan switching update both the list and the map", TRIP_URL, async () => {
    await page.getByRole("button", { name: "2일차" }).click();
    await expect(page.getByTestId("now-bar")).toContainText("1. 전주향교");
    await expect(pins(page)).toHaveCount(3);
    await page.getByRole("button", { name: "1일차" }).click();
    await expect(pins(page)).toHaveCount(7);

    await page.getByRole("combobox", { name: "여행 대안" }).selectOption("experience");
    await expect(stop(page, "d1-hanok-exp")).toBeVisible();
    await page.getByRole("combobox", { name: "여행 대안" }).selectOption("balanced");
    await expect(stop(page, "d1-hanok-exp")).toHaveCount(0);
  });

  await step("edit mode: required places are protected", TRIP_URL, async () => {
    await openEdit(page);
    await expect(stop(page, "d1-jeondong").getByRole("button", { name: "삭제" })).toHaveCount(0);
    // 전동성당 바로 다음이 경기전(둘 다 필수) -> 순서 교환은 거부된다
    await stop(page, "d1-jeondong").getByRole("button", { name: "아래로" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "필수 방문지끼리의 순서" })).toBeVisible();
  });

  await step("edit mode: exclude, reorder and add - the map follows instantly", TRIP_URL, async () => {
    await stop(page, "d1-snack").getByRole("button", { name: "제외", exact: true }).click();
    await expect(stop(page, "d1-snack")).toContainText("제외됨");
    await expect(pins(page)).toHaveCount(6);

    await stop(page, "d1-lunch").getByRole("button", { name: "위로" }).click();
    await expect.poll(async () => (await stopOrder(page))[0]).toBe("d1-lunch");
    await expect(page.getByTitle("1. 전주비빔밥 점심")).toBeVisible(); // 번호도 순서를 따라간다

    // 고정 시작 시각: 저녁을 18:00으로 바꾸면 카드와 하루 요약에 바로 반영된다
    await page.getByLabel("저녁 식사 고정 시작 시각").fill("18:00");
    await expect(stop(page, "d1-dinner")).toContainText("18:00");
    await expect(page.getByTestId("day-summary")).toContainText("대기");

    // 하루 출발 시각과 체류시간 직접 입력: 맨 앞(점심)이 출발 시각부터 시작하고 입력한 분만큼 길어진다
    await page.getByLabel("1일차 출발 시각").fill("10:00");
    await expect(stop(page, "d1-lunch")).toContainText("10:00–");
    await page.getByLabel("전주비빔밥 점심 체류시간(분)").fill("75");
    await page.getByLabel("전주비빔밥 점심 체류시간(분)").blur();
    await expect(stop(page, "d1-lunch")).toContainText("10:00–11:15");

    await page.getByLabel("일정 이름").fill("카페 휴식");
    await page.getByRole("button", { name: "장소 없는 일정 추가" }).click();
    await expect(page.getByText("카페 휴식", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "+ 내 장소 만들기" }).click();
    const form = page.getByRole("form", { name: "내 장소 만들기" });
    await form.getByLabel("장소 이름").fill(`E2E카페 ${runId}`);
    await form.getByLabel("위도").fill("35.8140");
    await form.getByLabel("경도").fill("127.1510");
    await form.getByRole("button", { name: "저장" }).click();
    // 편집 모드에서는 "장소 바꾸기" 목록의 <option>에도 같은 이름이 있어 getByText는 숨은 option을 잡는다.
    // 일정 카드의 끌어서 바꾸기 버튼으로 카드가 생겼는지 확인한다.
    await expect(page.getByRole("button", { name: `E2E카페 ${runId} 순서 끌어서 바꾸기` })).toBeVisible();
    await expect(pins(page)).toHaveCount(7); // 6 + 새 장소

    // 보기 모드로 돌아가면 제외된 항목은 숨겨진다
    await page.getByRole("button", { name: "편집 끝내기" }).click();
    await expect(stop(page, "d1-snack")).toHaveCount(0);
    // 편집은 화면에 먼저 반영되고 서버 저장은 순서대로 뒤에서 이어진다. 저장이 끝나기 전에 다른 페이지로
    // 이동하면 대기 중인 저장이 사라지므로(출발 시각·체류시간·새 장소 등), "저장 중…"이 없어질 때까지 기다린다.
    await expect(page.getByText("저장 중…")).toHaveCount(0, { timeout: 45_000 });
  });

  await step("phone width: no horizontal overflow", TRIP_URL, async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  await step("invite code is available from the family screen", /\/family$/, async () => {
    // 저장이 끝나면 앱이 1초 뒤 화면을 한 번 새로 받아오는데(router.refresh), 그 순간이 페이지 이동과 겹치면
    // 주소 기록 갱신이 이동을 취소(net::ERR_ABORTED)한다. 앱 문제가 아니라 겹침이라 이동을 재시도한다.
    await expect(async () => {
      await page.goto("/family");
    }).toPass({ timeout: 20_000 });
    const codeText = await page.getByText(/초대 코드:/).innerText();
    const match = codeText.match(/초대 코드:\s*([A-Z0-9]{6})/);
    if (!match) throw new Error(`invite code not found in: ${codeText}`);
    inviteCode = match[1];
  });

  await test.step("second family member sees the same trip and the first member's progress", async () => {
    const ctx2 = await browser.newContext();
    try {
      const page2 = await ctx2.newPage();
      await signUp(page2, username2);
      await page2.getByRole("button", { name: "초대 코드로 참여하기" }).click();
      await page2.getByPlaceholder("초대 코드 (6자리)").fill(inviteCode);
      await page2.getByRole("button", { name: "참여하기" }).click();
      await page2.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });

      await page2.goto(tripUrl);
      await expect(page2.getByRole("heading", { name: "전주 가족 1박 2일" })).toBeVisible();
      await expect(stop(page2, "d1-parking")).toContainText("완료");
      // 첫 번째 구성원이 쓴 메모/상태가 그대로 보인다
      // 점심이 "지금 가야 할 곳"이라 상세가 이미 열려 있다(버튼은 "닫기"). 닫혀 있을 때만 연다.
      const detail2 = page2.getByRole("region", { name: "전주비빔밥 점심 상세" });
      if ((await detail2.count()) === 0) await stop(page2, "d1-lunch").getByRole("button", { name: /상세 열기/ }).click();
      await expect(detail2).toBeVisible();
      // 첫 번째 구성원의 댓글이 작성자 이름과 함께 보이고, 남의 댓글에는 삭제 버튼이 없다
      const comments2 = detail2.getByRole("list", { name: "전주비빔밥 점심 댓글 목록" });
      await expect(comments2).toContainText(`예약 완료 ${runId}`);
      await expect(comments2.getByTestId("comment-author").first()).not.toBeEmpty();
      await expect(detail2.getByRole("button", { name: /의 댓글 삭제/ })).toHaveCount(0);
      await expect(detail2.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true");
      // 첫 번째 구성원이 바꾼 출발 시각·체류시간이 두 번째 구성원 화면에도 반영돼 있다
      await expect(stop(page2, "d1-lunch")).toContainText("10:00–11:15");
      // 소감·사진도 가족에게 보인다 (테이블 RLS + 스토리지 RLS)
      await expect(detail2.getByLabel(/소감 \(가족 모두에게 보여요\)/)).toHaveValue(`비빔밥이 맛있었어요 ${runId}`);
      await expect(detail2.getByRole("img", { name: "전주비빔밥 점심 사진 1" })).toBeVisible();
      // 올린 사람이 아니면 사진 삭제 버튼이 없다
      await detail2.getByRole("button", { name: "전주비빔밥 점심 사진 1 크게 보기" }).click();
      await expect(page2.getByRole("button", { name: "삭제" })).toHaveCount(0);
      await expect(page2.getByTestId("photo-caption")).toContainText("·"); // 올린 사람 · 시각
      await page2.getByRole("button", { name: "사진 닫기" }).click();

      // 두 번째 구성원이 쓴 댓글도 첫 번째 사람에게 보인다
      await detail2.getByLabel("전주비빔밥 점심 댓글 쓰기").fill(`두 번째 구성원 댓글 ${runId}`);
      await detail2.getByRole("button", { name: "전주비빔밥 점심 댓글 등록" }).click();
      await expect(comments2).toContainText(`두 번째 구성원 댓글 ${runId}`);
      await expect(async () => {
        await page.goto(tripUrl);
        await expect(page.getByRole("list", { name: "전주비빔밥 점심 댓글 목록" })).toContainText(`두 번째 구성원 댓글 ${runId}`, { timeout: 2_000 });
      }).toPass({ timeout: 20_000 });

      // 동시 편집: 두 사람이 같은 날 일정에서 서로 다른 항목을 동시에 제외해도 둘 다 남아야 한다
      await page.goto(tripUrl);
      await page2.goto(tripUrl);
      await openEdit(page);
      await openEdit(page2);
      const both = countServerActions(page);
      await Promise.all([
        stop(page, "d1-dinner").getByRole("button", { name: "제외", exact: true }).click(),
        stop(page2, "d1-hanok-walk").getByRole("button", { name: "제외", exact: true }).click(),
      ]);
      await expect(stop(page, "d1-dinner")).toContainText("제외됨");
      await expect(stop(page2, "d1-hanok-walk")).toContainText("제외됨");
      await expect.poll(() => both.state.n, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);
      both.stop();
      await expect(async () => {
        for (const pg of [page, page2]) {
          await pg.goto(tripUrl);
          await openEdit(pg);
          await expect(stop(pg, "d1-dinner")).toContainText("제외됨", { timeout: 2_000 });
          await expect(stop(pg, "d1-hanok-walk")).toContainText("제외됨", { timeout: 2_000 });
        }
      }).toPass({ timeout: 25_000 });

      // 만든 사람이 아니면 삭제 버튼이 없다
      await expect(page2.getByRole("button", { name: "이 여행 삭제" })).toHaveCount(0);
    } finally {
      await ctx2.close();
    }
  });

  await test.step("a user from a different family cannot see the trip", async () => {
    const ctx3 = await browser.newContext();
    try {
      const page3 = await ctx3.newPage();
      await signUp(page3, outsider);
      await page3.getByRole("button", { name: "새 가족 만들기" }).click();
      await page3.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(`E2E 타인 가족 ${runId}`);
      await page3.getByRole("button", { name: "가족 만들기" }).click();
      await page3.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });

      await page3.goto(tripUrl);
      // RLS 때문에 여행이 조회되지 않으면 notFound() -> 기본 404 화면
      await expect(page3.getByRole("heading", { name: "전주 가족 1박 2일" })).toHaveCount(0);
      await expect(page3.getByText("This page could not be found")).toBeVisible();
      await page3.goto("/trips");
      await expect(page3.getByText("아직 여행이 없어요")).toBeVisible();
    } finally {
      await ctx3.close();
    }
  });

  await step("creator can delete the trip", /\/trips$/, async () => {
    await page.goto(tripUrl);
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "이 여행 삭제" }).click();
    await page.waitForURL("**/trips");
    await expect(page.getByText("아직 여행이 없어요")).toBeVisible();
  });
});
