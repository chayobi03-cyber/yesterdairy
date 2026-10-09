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
    // 1일차: 좌표가 있는 8곳이 지도에 번호 핀으로 (숙소는 좌표가 없어 목록에만 있다)
    await expect(pins(page)).toHaveCount(8);
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

  await step("check-list, memo, cost and status are saved", TRIP_URL, async () => {
    const detail = page.getByRole("region", { name: "전주비빔밥 점심 상세" });
    await detail.getByRole("checkbox").first().check();
    await detail.getByLabel(/메모/).fill(`예약 완료 ${runId}`);
    await detail.getByLabel(/지출/).fill("45000");
    await detail.getByLabel(/지출/).blur();
    await detail.getByRole("button", { name: "📍 도착" }).click();
    await expect(detail.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true");
    // 연달아 누른 저장 요청(완료, 체크, 메모, 지출, 상태)이 모두 끝날 때까지 기다린 뒤 새로고침한다
    await expect.poll(() => actions.state.n, { timeout: 20_000 }).toBeGreaterThanOrEqual(5);
    actions.stop();
    await expect(page.getByText("저장 중…")).toHaveCount(0);
    await expect(async () => {
      await page.reload();
      const d = page.getByRole("region", { name: "전주비빔밥 점심 상세" });
      await expect(d.getByLabel(/메모/)).toHaveValue(`예약 완료 ${runId}`, { timeout: 2_000 });
      await expect(d.getByRole("checkbox").first()).toBeChecked({ timeout: 2_000 });
      await expect(d.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
      await expect(page.getByRole("button", { name: "한옥마을 인근 주차 완료 취소" })).toBeVisible({ timeout: 2_000 });
      await expect(page.getByText("누적 지출 기록 45,000원")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
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
    await expect(pins(page)).toHaveCount(8);

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
    await expect(pins(page)).toHaveCount(7);

    await stop(page, "d1-lunch").getByRole("button", { name: "위로" }).click();
    await expect.poll(async () => (await stopOrder(page))[0]).toBe("d1-lunch");
    await expect(page.getByTitle("1. 전주비빔밥 점심")).toBeVisible(); // 번호도 순서를 따라간다

    await page.getByLabel("일정 이름").fill("카페 휴식");
    await page.getByRole("button", { name: "장소 없는 일정 추가" }).click();
    await expect(page.getByText("카페 휴식", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "+ 내 장소 만들기" }).click();
    const form = page.getByRole("form", { name: "내 장소 만들기" });
    await form.getByLabel("장소 이름").fill(`E2E카페 ${runId}`);
    await form.getByLabel("위도").fill("35.8140");
    await form.getByLabel("경도").fill("127.1510");
    await form.getByRole("button", { name: "저장" }).click();
    await expect(page.getByText(`E2E카페 ${runId}`).first()).toBeVisible();
    await expect(pins(page)).toHaveCount(8); // 7 + 새 장소

    // 보기 모드로 돌아가면 제외된 항목은 숨겨진다
    await page.getByRole("button", { name: "편집 끝내기" }).click();
    await expect(stop(page, "d1-snack")).toHaveCount(0);
  });

  await step("phone width: no horizontal overflow", TRIP_URL, async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  await step("invite code is available from the family screen", /\/family$/, async () => {
    await page.goto("/family");
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
      await stop(page2, "d1-lunch").getByRole("button", { name: /상세 열기/ }).click();
      const detail2 = page2.getByRole("region", { name: "전주비빔밥 점심 상세" });
      await expect(detail2.getByLabel(/메모/)).toHaveValue(`예약 완료 ${runId}`);
      await expect(detail2.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true");

      // 두 번째 구성원이 쓴 메모도 첫 번째 사람에게 보인다
      await detail2.getByLabel(/메모/).fill(`두 번째 구성원 메모 ${runId}`);
      await detail2.getByLabel(/메모/).blur();
      await expect(async () => {
        await page.goto(tripUrl);
        await expect(page.getByLabel(/메모/).first()).toHaveValue(`두 번째 구성원 메모 ${runId}`, { timeout: 2_000 });
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
