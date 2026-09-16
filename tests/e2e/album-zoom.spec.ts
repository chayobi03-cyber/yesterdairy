import { test, expect } from "@playwright/test";

// Real-world scenario: a photo in the album is too small to see detail in
// (e.g. handwriting, a face in the background). Tapping it should open a
// full-screen viewer that can be zoomed in/out, not just the thumbnail.
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_zoom_${runId}`;
const password = "TestPass123!";
const familyName = `E2E 확대 가족 ${runId}`;

test("tapping an album photo opens a zoomable viewer", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("아이디 (로그인용)").fill(username);
  await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding");

  await page.getByRole("button", { name: "새 가족 만들기" }).click();
  await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(familyName);
  await page.getByRole("button", { name: "가족 만들기" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });

  await page.goto("/write");
  await page.locator('textarea[name="content"]').fill(`확대 테스트 기록 ${runId}`);
  await page.locator('input[name="photos"]').setInputFiles("tests/e2e/fixtures/test-photo.png");
  await page.getByRole("button", { name: "기록하기" }).click();
  await page.waitForURL("/");

  await page.goto("/album");
  await page.getByRole("button", { name: "사진 크게 보기" }).click();

  await expect(page.getByLabel("축소")).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();

  await page.getByLabel("확대").click();
  await expect(page.getByText("150%")).toBeVisible();

  // double-tap (double-click on desktop Chromium) resets zoom back to 100%
  await page.locator(".fixed.inset-0.z-50 img").dblclick();
  await expect(page.getByText("100%")).toBeVisible();

  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByLabel("축소")).not.toBeVisible();
});
