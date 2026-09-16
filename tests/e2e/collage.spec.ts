import { test, expect } from "@playwright/test";

// Real-world scenario: after a few weeks of entries with photos, the family
// wants to combine several into one shareable image (a phone-camera-app
// style collage) instead of scrolling the album one photo at a time.
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_collage_${runId}`;
const password = "TestPass123!";
const familyName = `E2E 콜라주 가족 ${runId}`;

test("making a 2x2 collage from album photos", async ({ page }) => {
  await page.goto("/signup");
  await page.getByPlaceholder("아이디 (로그인용)").fill(username);
  await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding");

  await page.getByRole("button", { name: "새 가족 만들기" }).click();
  await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(familyName);
  await page.getByRole("button", { name: "가족 만들기" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });

  // one entry, four photos -- enough media rows to build a 2x2 collage from
  await page.goto("/write");
  await page.locator('textarea[name="content"]').fill(`콜라주 테스트 기록 ${runId}`);
  await page.locator('input[name="photos"]').setInputFiles([
    "tests/e2e/fixtures/test-photo.png",
    "tests/e2e/fixtures/test-photo.png",
    "tests/e2e/fixtures/test-photo.png",
    "tests/e2e/fixtures/test-photo.png",
  ]);
  await page.getByRole("button", { name: "기록하기" }).click();
  await page.waitForURL("/");

  await page.goto("/album");
  await expect(page.locator("img")).toHaveCount(4);

  await page.getByRole("link", { name: "🧩 콜라주 만들기" }).click();
  await page.waitForURL("**/album/collage");

  // 2x2 is the default layout -- select exactly 4 photos
  const thumbnails = page.getByRole("button", { name: "콜라주에 추가" });
  await expect(thumbnails).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await thumbnails.nth(0).click(); // each click re-numbers the remaining "add" buttons
  }
  await expect(page.getByText("4/4장 선택됨", { exact: false })).toBeVisible();

  const makeButton = page.getByRole("button", { name: "콜라주 만들기" });
  await expect(makeButton).toBeEnabled();
  await makeButton.click();

  await expect(page.getByAltText("완성된 콜라주")).toBeVisible();
  await expect(page.getByRole("link", { name: /다운로드/ })).toBeVisible();
});
