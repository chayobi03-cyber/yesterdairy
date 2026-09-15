import { test, expect, devices } from "@playwright/test";

// This is a phone-first PWA, but the main core-flow suite runs at desktop
// viewport size (Playwright's default project) since re-running the whole
// 20+ step flow a second time at phone size would double the load this
// suite already puts on the shared Supabase project. Instead, this is a
// narrow, cheap check -- one signup, a handful of key screens -- purely for
// "does anything overflow horizontally at real phone width," which desktop
// viewport testing can't catch on its own.
//
// Pixel 7, not an iPhone device -- Playwright's iPhone descriptors default
// to WebKit as the engine, and CI only installs Chromium. Pixel 7's
// dimensions are close enough (412x915 vs. iPhone 13's 390x844) to catch
// the same class of horizontal-overflow bugs.
test.use({ ...devices["Pixel 7"] });

const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_mobile_${runId}`;
const password = "TestPass123!";
const familyName = `E2E 모바일 가족 ${runId}`;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, screenName: string) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${screenName} overflows horizontally by ${overflow}px at phone width`).toBeLessThanOrEqual(1);
}

test("core screens fit without horizontal overflow at phone width", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("아이디 (로그인용)").fill(username);
  await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding");

  await page.getByRole("button", { name: "새 가족 만들기" }).click();
  await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(familyName);
  await page.getByRole("button", { name: "가족 만들기" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });
  await expectNoHorizontalOverflow(page, "홈");

  for (const path of ["/write", "/calendar", "/family", "/album", "/colors", "/settings"]) {
    await page.goto(path);
    await expectNoHorizontalOverflow(page, path);
  }

  // the bottom nav must still be fully visible (not clipped) at phone width
  const nav = page.locator("nav");
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(5);
});
