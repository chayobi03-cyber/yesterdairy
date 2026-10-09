import { test, expect, type Page } from "@playwright/test";

// 가족 여행 플래너: 한 사람이 템플릿으로 여행을 만들고 장소별로 진행 기록을 남기면,
// 같은 가족의 두 번째 구성원이 그 기록을 그대로 본다 (RLS가 가족 범위로 공유).
// 다른 가족은 그 여행을 볼 수 없다.
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_trip_${runId}`;
const username2 = `e2e_trip_${runId}_2`;
const outsider = `e2e_trip_${runId}_x`;
const password = "TestPass123!";

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

test("family trip: create from template -> place-by-place progress -> shared with family only", async ({ page, browser }) => {
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

  await step("create a trip from the Jeonju template", /\/trips\/[0-9a-f-]{36}$/, async () => {
    await page.getByRole("button", { name: "+ 새 여행 만들기" }).click();
    await page.getByRole("button", { name: "여행 만들기" }).click();
    await page.waitForURL(/\/trips\/[0-9a-f-]{36}$/);
    tripUrl = page.url();
    await expect(page.getByRole("heading", { name: "전주 가족 1박 2일" })).toBeVisible();
    // 첫 장소가 현재 장소로 보인다
    await expect(page.getByRole("region", { name: /1\. 한옥마을 인근 주차/ })).toBeVisible();
  });

  await step("mark the first place done and move on to the next place", /\/trips\/[0-9a-f-]{36}\?.*focus=d1-lunch/, async () => {
    await page.getByRole("button", { name: /완료하고 다음: 전주비빔밥 점심/ }).click();
    await page.waitForURL(/focus=d1-lunch/);
    await expect(page.getByRole("region", { name: /2\. 전주비빔밥 점심/ })).toBeVisible();
  });

  await step("check-list, memo and cost are saved", /focus=d1-lunch/, async () => {
    const card = page.getByRole("region", { name: /2\. 전주비빔밥 점심/ });
    // 저장은 서버 액션 POST로 나간다. 응답이 몇 번 왔는지 세어서 저장이 끝났는지 판단한다
    // (networkidle은 링크 프리페치/자동 새로고침 때문에 끝나지 않는다).
    let actionResponses = 0;
    const countAction = (r: import("@playwright/test").Response) => {
      if (r.request().method() === "POST" && r.request().headers()["next-action"]) actionResponses++;
    };
    page.on("response", countAction);
    await card.getByRole("checkbox").first().check();
    await card.getByLabel(/메모/).fill(`예약 완료 ${runId}`);
    await card.getByLabel(/지출/).fill("45000");
    await card.getByLabel(/지출/).blur();
    await page.getByRole("button", { name: "📍 도착" }).click();
    await expect(page.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true");
    // 연달아 누른 저장 요청은 서버 액션 대기열에서 순서대로 처리된다. 끝나기 전에 새로고침하면
    // 대기 중인 요청이 사라지므로(사용자도 마찬가지), 4건(체크, 메모, 지출, 상태) 응답을 기다린다.
    await expect.poll(() => actionResponses, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
    page.off("response", countAction);
    await expect(page.getByText("저장 중…")).toHaveCount(0);
    // DB에 남았는지 새로고침해서 확인 (재시도)
    await expect(async () => {
      await page.reload();
      await expect(card.getByLabel(/메모/)).toHaveValue(`예약 완료 ${runId}`, { timeout: 2_000 });
      await expect(card.getByRole("checkbox").first()).toBeChecked({ timeout: 2_000 });
      await expect(page.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true", { timeout: 2_000 });
      await expect(page.getByText("누적 지출 기록 45,000원")).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  });

  await step("plan view: required places cannot be deleted or swapped", /view=plan/, async () => {
    await page.getByRole("tab", { name: "일정" }).click();
    await page.waitForURL(/view=plan/);
    // 필수 방문지(전동성당)에는 삭제 버튼이 없다
    const jeondong = page.locator("div.rounded-2xl", { hasText: "전동성당" }).filter({ has: page.getByRole("button", { name: "제외" }) }).first();
    await expect(jeondong.getByRole("button", { name: "삭제" })).toHaveCount(0);
    // 전동성당 바로 다음이 경기전(둘 다 필수) -> 순서 교환은 거부된다
    await jeondong.getByRole("button", { name: "아래로" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "필수 방문지끼리의 순서" })).toBeVisible();
  });

  await step("excluding an optional place and changing its duration", /view=plan/, async () => {
    const snack = page.locator("div.rounded-2xl", { hasText: "초코파이·길거리 간식" }).filter({ has: page.getByRole("button", { name: "제외" }) }).first();
    await snack.getByRole("button", { name: "제외" }).click();
    await expect(page.locator("div.rounded-2xl", { hasText: "초코파이·길거리 간식" }).filter({ hasText: "제외됨" }).first()).toBeVisible();
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
      await page2.goto(`${tripUrl}?focus=d1-lunch`);
      const card2 = page2.getByRole("region", { name: /2\. 전주비빔밥 점심/ });
      await expect(card2.getByLabel(/메모/)).toHaveValue(`예약 완료 ${runId}`);
      await expect(page2.getByRole("button", { name: "📍 도착" })).toHaveAttribute("aria-pressed", "true");

      // 두 번째 구성원이 쓴 메모도 첫 번째 사람에게 보인다
      await card2.getByLabel(/메모/).fill(`두 번째 구성원 메모 ${runId}`);
      await card2.getByLabel(/메모/).blur();
      await page2.waitForTimeout(500);
      await page.goto(`${tripUrl}?focus=d1-lunch`);
      await expect(page.getByLabel(/메모/)).toHaveValue(`두 번째 구성원 메모 ${runId}`);

      // 동시 편집: 두 사람이 같은 날 일정에서 서로 다른 항목을 동시에 제외해도 둘 다 남아야 한다
      // (낙관적 잠금: 충돌하면 최신 데이터에 같은 변경을 다시 적용)
      const row = (pg: Page, name: string) =>
        pg.locator("div.rounded-2xl", { hasText: name }).filter({ has: pg.getByRole("button", { name: /^(제외|포함)$/ }) }).first();
      await page.goto(`${tripUrl}?view=plan`);
      await page2.goto(`${tripUrl}?view=plan`);
      await Promise.all([
        row(page, "저녁 식사").getByRole("button", { name: "제외" }).click(),
        row(page2, "한옥마을 골목 산책").getByRole("button", { name: "제외" }).click(),
      ]);
      await expect(row(page, "저녁 식사").getByText("제외됨")).toBeVisible();
      await expect(row(page2, "한옥마을 골목 산책").getByText("제외됨")).toBeVisible();
      await page.goto(`${tripUrl}?view=plan`);
      await page2.goto(`${tripUrl}?view=plan`);
      for (const pg of [page, page2]) {
        await expect(row(pg, "저녁 식사").getByText("제외됨")).toBeVisible();
        await expect(row(pg, "한옥마을 골목 산책").getByText("제외됨")).toBeVisible();
      }

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
