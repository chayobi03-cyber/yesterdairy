import { test, expect } from "@playwright/test";

// Real-world scenario: the browser (or OS) has denied camera access --
// previously revoked, or blocked by a parental-control/MDM profile. This is
// distinct from the happy-path camera test in core-flow.spec.ts, which runs
// with Chromium's fake device auto-granting the prompt. Here we simulate an
// actual getUserMedia rejection instead, since Chromium's fake-ui flag has
// no "deny" mode to exercise the failure path with.
const runId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const username = `e2e_camdeny_${runId}`;
const password = "TestPass123!";
const familyName = `E2E 카메라거부 가족 ${runId}`;

test("color-hunt camera shows a clear fallback when permission is denied", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () =>
      Promise.reject(new DOMException("Permission denied", "NotAllowedError"));
  });

  await page.goto("/signup");
  await page.getByPlaceholder("아이디 (로그인용)").fill(username);
  await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
  await page.getByRole("button", { name: "가입하기" }).click();
  await page.waitForURL("**/onboarding");

  await page.getByRole("button", { name: "새 가족 만들기" }).click();
  await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(familyName);
  await page.getByRole("button", { name: "가족 만들기" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });

  await page.getByRole("link", { name: /오늘의 미션/ }).click();
  await page.waitForURL("**/colors/capture");

  await expect(page.getByText("카메라를 사용할 수 없어요. 브라우저 권한을 확인해주세요.")).toBeVisible();
  await expect(page.getByRole("button", { name: "채집하기" })).toBeDisabled();

  // closing out of the denied camera view should still work
  await page.getByRole("button", { name: "닫기" }).click();
});
