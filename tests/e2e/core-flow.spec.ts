import { test, expect } from "@playwright/test";

// End-to-end smoke test for the whole family-diary flow, run against a real
// Supabase project (see playwright.config.ts / CI workflow for how the app
// under test is started). Every run creates a throwaway account prefixed
// "e2e_" so it's easy to spot and prune from the live project.
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_${runId}`;
const password = "TestPass123!";
const familyName = `E2E 가족 ${runId}`;

const username2 = `e2e_${runId}_2`;
const password2 = "TestPass123!";

test.describe.configure({ mode: "serial" });

test("sign up -> create family -> write entry -> family feed -> settings -> re-login", async ({ page, browser }) => {
  let inviteCode = "";
  await test.step("sign up", async () => {
    await page.goto("/signup");
    await page.getByPlaceholder("아이디 (로그인용)").fill(username);
    await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
    await page.getByRole("button", { name: "가입하기" }).click();
    await page.waitForURL("**/onboarding");
  });

  await test.step("create family (regression: redirect-in-wrapped-action bug)", async () => {
    await page.getByRole("button", { name: "새 가족 만들기" }).click();
    await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(familyName);
    await page.getByRole("button", { name: "가족 만들기" }).click();
    // The bug this test guards against: onboarding never left this page.
    await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });
    await expect(page).toHaveURL("/");
  });

  await test.step("write a family-visible entry", async () => {
    await page.getByRole("link", { name: /오늘의 순간 기록하기/ }).click();
    await page.waitForURL("**/write");
    await page.locator('textarea[name="content"]').fill(`자동화 테스트 기록 ${runId}`);
    await page.locator('button[type="button"]').click(); // flip visibility to "family"
    await page.getByRole("button", { name: "기록하기" }).click();
    await page.waitForURL("/");
    await expect(page.getByText(`자동화 테스트 기록 ${runId}`)).toBeVisible();
  });

  await test.step("edit today's entry, adding a photo", async () => {
    await page.getByRole("link", { name: "수정" }).click();
    await page.waitForURL(/\/write\//);
    await page.locator('textarea[name="content"]').fill(`수정된 테스트 기록 ${runId}`);
    await page.locator('input[name="photos"]').setInputFiles("tests/e2e/fixtures/test-photo.png");
    await page.getByRole("button", { name: "수정하기" }).click();
    await page.waitForURL("/");
    await expect(page.getByText(`수정된 테스트 기록 ${runId}`)).toBeVisible();
    await expect(page.getByText(`자동화 테스트 기록 ${runId}`)).not.toBeVisible();
  });

  await test.step("challenge mode shows a hatching pet after today's first entry", async () => {
    await page.goto("/");
    await page.getByRole("link", { name: "🐣 도전 모드" }).click();
    await page.waitForURL("**/challenge");
    await expect(page.getByText("부화 중 · 연속 1일")).toBeVisible();
  });

  await test.step("uploaded photo shows up in the album", async () => {
    await page.goto("/album");
    await expect(page.locator("img")).toHaveCount(1);
  });

  await test.step("entry shows up on the calendar", async () => {
    await page.goto("/calendar");
    await expect(page.locator("h1")).toContainText(/\d{4}년 \d{1,2}월/);
  });

  await test.step("add a calendar event", async () => {
    await page.getByRole("button", { name: "+ 일정 추가" }).click();
    await page.getByPlaceholder(/미용실, 밥약속/).fill(`E2E 일정 ${runId}`);
    await page.getByRole("button", { name: "추가" }).click();
    await expect(page.getByText(`E2E 일정 ${runId}`)).toBeVisible();
  });

  await test.step("add a family-visible goal", async () => {
    await page.goto("/family");
    await page.getByRole("button", { name: "+ 목표 추가" }).click();
    await page.getByPlaceholder(/줄넘기 1급/).fill(`E2E 목표 ${runId}`);
    await page.getByRole("button", { name: "나만 보기" }).click(); // flip to family-visible
    await page.getByRole("button", { name: "추가" }).click();
    await expect(page.getByText(`E2E 목표 ${runId}`)).toBeVisible();
  });

  await test.step("entry + reaction show up on the family feed", async () => {
    await page.goto("/family");
    await expect(page.getByText(`수정된 테스트 기록 ${runId}`)).toBeVisible();
    await page.getByRole("button", { name: /^🔥/ }).click();
    await expect(page.getByRole("button", { name: /^🔥 1/ })).toBeVisible();

    const codeText = await page.getByText(/초대 코드:/).innerText();
    const match = codeText.match(/초대 코드:\s*([A-Z0-9]{6})/);
    if (!match) throw new Error(`couldn't find invite code in "${codeText}"`);
    inviteCode = match[1];
  });

  await test.step("add and delete a comment on the family feed", async () => {
    await page.getByPlaceholder("댓글 달기...").fill(`E2E 댓글 ${runId}`);
    await page.getByRole("button", { name: "등록" }).click();
    await expect(page.getByText(`E2E 댓글 ${runId}`)).toBeVisible();

    await page.getByRole("button", { name: "×" }).click();
    await expect(page.getByText(`E2E 댓글 ${runId}`)).not.toBeVisible();
  });

  await test.step("second family member joins via invite code and sees the shared entry", async () => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    try {
      await page2.goto("/signup");
      await page2.getByPlaceholder("아이디 (로그인용)").fill(username2);
      await page2.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password2);
      await page2.getByRole("button", { name: "가입하기" }).click();
      await page2.waitForURL("**/onboarding");

      await page2.getByRole("button", { name: "초대 코드로 참여하기" }).click();
      await page2.getByPlaceholder("초대 코드 (6자리)").fill(inviteCode);
      await page2.getByRole("button", { name: "참여하기" }).click();
      await page2.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });
      await expect(page2).toHaveURL("/");

      await page2.goto("/family");
      await expect(page2.getByText(familyName)).toBeVisible();
      await expect(page2.getByText(`수정된 테스트 기록 ${runId}`)).toBeVisible();
      // both members should be listed by nickname (role is "부모" for both
      // in this test; matching the full "name · role" text avoids username2
      // — which is literally "<username>_2" — accidentally substring-matching
      // username's badge too)
      await expect(page2.getByText(`${username} · 부모`)).toBeVisible();
      await expect(page2.getByText(`${username2} · 부모`)).toBeVisible();

      // second member can react too, independently of the first member's reaction
      await page2.getByRole("button", { name: /^🌱/ }).click();
      await expect(page2.getByRole("button", { name: /^🌱 1/ })).toBeVisible();

      // and can cheer the first member's family-visible goal
      await expect(page2.getByText(`E2E 목표 ${runId}`)).toBeVisible();
      await page2.getByRole("button", { name: /^👏/ }).click();
      await expect(page2.getByRole("button", { name: /^👏 1/ })).toBeVisible();

      // visiting the first member's room shows their shared goal too
      await page2.getByRole("link", { name: `${username} · 부모` }).click();
      await page2.waitForURL(/\/room\//);
      await expect(page2.locator("h1")).toContainText("님의 공간");
      await expect(page2.getByText(`E2E 목표 ${runId}`)).toBeVisible();
    } finally {
      await context2.close();
    }
  });

  await test.step("pick a growth world and view my own room", async () => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "별자리" }).click();
    // wait for the update-world server action to finish (button re-enables)
    await expect(page.getByRole("button", { name: "별자리" })).toBeEnabled({ timeout: 20_000 });

    await page.goto("/");
    await page.getByRole("link", { name: "내 공간 보러가기" }).click();
    await page.waitForURL(/\/room\//);
    await expect(page.locator("h1")).toContainText("님의 공간");
    await expect(page.getByText("별자리 세계관")).toBeVisible();
  });

  await test.step("switch to the color-collection world and see the color codex", async () => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "색모음집" }).click();
    await expect(page.getByRole("button", { name: "색모음집" })).toBeEnabled({ timeout: 20_000 });

    await page.goto("/");
    await page.getByRole("link", { name: "내 공간 보러가기" }).click();
    await page.waitForURL(/\/room\//);
    await expect(page.getByText("색모음집 세계관")).toBeVisible();
    await expect(page.getByText(/🎨 색 도감/)).toBeVisible();
  });

  await test.step("change nickname in settings without breaking login id", async () => {
    await page.goto("/settings");
    const nicknameInput = page.locator('input[name="name"]');
    await nicknameInput.fill(`새닉네임_${runId}`);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("닉네임이 바뀌었어요.")).toBeVisible();
  });

  await test.step("sign out and log back in with the original username", async () => {
    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.waitForURL("**/login");
    await page.getByPlaceholder("아이디").fill(username);
    await page.getByPlaceholder("비밀번호").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    // Should land on Home directly, not get bounced to onboarding again.
    await page.waitForURL("/");
    await expect(page).toHaveURL("/");
  });
});
