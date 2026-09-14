import { test, expect } from "@playwright/test";

// Regression test for a real bug: the server used to compute "today" with
// its own clock (UTC on Vercel), so a family member writing an entry after
// local midnight in a timezone ahead of UTC could get it silently stamped
// with the server's still-previous day. LocalDateSync + lib/today.ts fix
// this by syncing a `local_date` cookie from the browser's own clock.
//
// The browser's clock and timezone are faked here so the local calendar
// date is deterministically one day ahead of the server's UTC date,
// regardless of when this test actually runs.
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_tz_${runId}`;
const password = "TestPass123!";
const familyName = `E2E TZ 가족 ${runId}`;

test.use({ timezoneId: "Pacific/Kiritimati" }); // UTC+14

test("entry written after local midnight is dated locally, not by server UTC", async ({ page }) => {
  // 23:30 UTC on a fixed date -- local time in Kiritimati (UTC+14) is
  // already 13:30 the *next* day.
  await page.clock.install({ time: new Date("2026-03-10T23:30:00Z") });

  await page.goto("/signup");
  // give the root layout's LocalDateSync a moment to set the local_date
  // cookie from the faked clock/timezone before we start the flow.
  await page.waitForTimeout(300);

  await page.getByPlaceholder("아이디 (로그인용)").fill(username);
  await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding");

  await page.getByRole("button", { name: "새 가족 만들기" }).click();
  await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(familyName);
  await page.getByRole("button", { name: "가족 만들기" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });

  await page.getByRole("link", { name: /오늘의 순간 기록하기/ }).click();
  await page.waitForURL("**/write");
  await page.locator('textarea[name="content"]').fill(`시간대 테스트 기록 ${runId}`);
  await page.getByRole("button", { name: "기록하기" }).click();
  await page.waitForURL("/");
  await expect(page.getByText(`시간대 테스트 기록 ${runId}`)).toBeVisible();

  // The entry must land on the *local* date (2026-03-11), not the server's
  // UTC date (2026-03-10).
  await page.goto("/calendar/2026-03-11");
  await expect(page.getByText(`시간대 테스트 기록 ${runId}`)).toBeVisible();

  await page.goto("/calendar/2026-03-10");
  await expect(page.getByText(`시간대 테스트 기록 ${runId}`)).not.toBeVisible();
});
