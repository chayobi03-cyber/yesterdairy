import { test, expect } from "@playwright/test";

// End-to-end smoke test for the whole family-diary flow, run against a real
// Supabase project (see playwright.config.ts / CI workflow for how the app
// under test is started). Every run creates a throwaway account prefixed
// "e2e_" so it's easy to spot and prune from the live project.
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_${runId}`;
const password = "TestPass123!";
const familyName = `E2E 가족 ${runId}`;

test.describe.configure({ mode: "serial" });

test("sign up -> create family -> write entry -> family feed -> settings -> re-login", async ({ page }) => {
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

  await test.step("entry shows up on the calendar", async () => {
    await page.goto("/calendar");
    await expect(page.locator("h1")).toContainText(/\d{4}년 \d{1,2}월/);
  });

  await test.step("entry + reaction show up on the family feed", async () => {
    await page.goto("/family");
    await expect(page.getByText(`자동화 테스트 기록 ${runId}`)).toBeVisible();
    await page.getByRole("button", { name: /^🔥/ }).click();
    await expect(page.getByRole("button", { name: /^🔥 1/ })).toBeVisible();
  });

  await test.step("change nickname in settings without breaking login id", async () => {
    await page.goto("/settings");
    const nicknameInput = page.locator('input[name="name"]');
    await nicknameInput.fill(`새닉네임_${runId}`);
    await page.getByRole("button", { name: "저장" }).click();
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
