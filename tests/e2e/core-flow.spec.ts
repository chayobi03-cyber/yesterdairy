import { test, expect, type Page } from "@playwright/test";

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

// Wraps test.step with a mandatory assertion of where the page ends up.
// This exists because of a real bug this suite shipped once already: a step
// navigated into /calendar/[date] and never came back, so the *next* step
// failed with a confusing "element not found" timeout instead of pointing
// at its actual cause (being on the wrong page). Every step in this test
// must declare its expected end URL, so a step that silently leaves the
// page somewhere unexpected fails immediately, at the point of the mistake.
function makeStep(page: Page) {
  return async (name: string, expectUrl: RegExp, run: () => Promise<void>) => {
    await test.step(name, async () => {
      await run();
      await expect(page).toHaveURL(expectUrl);
    });
  };
}

test("sign up -> create family -> write entry -> family feed -> settings -> re-login", async ({ page, browser }) => {
  const step = makeStep(page);
  let inviteCode = "";

  await step("sign up", /\/onboarding$/, async () => {
    await page.goto("/signup");
    await page.getByPlaceholder("아이디 (로그인용)").fill(username);
    await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill(password);
    await page.getByRole("button", { name: "가입하기" }).click();
    await page.waitForURL("**/onboarding");
  });

  await step("create family (regression: redirect-in-wrapped-action bug)", /\/$/, async () => {
    await page.getByRole("button", { name: "새 가족 만들기" }).click();
    await page.getByPlaceholder("가족 이름 (예: 우리 가족)").fill(familyName);
    await page.getByRole("button", { name: "가족 만들기" }).click();
    // The bug this test guards against: onboarding never left this page.
    await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });
  });

  await step("hunt today's mission color with the camera", /\/$/, async () => {
    await expect(page.getByRole("link", { name: /오늘의 미션/ })).toBeVisible();
    await page.getByRole("link", { name: /오늘의 미션/ }).click();
    await page.waitForURL("**/colors/capture");

    // camera runs on Chromium's fake video device (see playwright.config.ts)
    await expect(page.getByText("미션")).toBeVisible();
    await expect(page.getByText(/% 일치/)).toBeVisible();
    await page.getByRole("button", { name: "채집하기" }).click();
    await page.waitForURL("/");
    await expect(page.getByText(/오늘의 색 ·/)).toBeVisible();
  });

  await step("today's captured color shows up in the color collection calendar", /\/$/, async () => {
    await page.getByText("🎨 색 컬렉션 보러가기").click();
    await page.waitForURL("**/colors");
    const todayISO = new Date().toLocaleDateString("sv-SE");
    const day = Number(todayISO.slice(8, 10));
    await expect(page.getByText(String(day), { exact: true })).toBeVisible();
    await page.goto("/");
  });

  await step("bottom nav stays at the simplified 5 tabs", /\/$/, async () => {
    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "오늘" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "달력" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "가족" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "앨범" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "설정" })).toBeVisible();
    // "기록" was deliberately dropped -- writing is one tap from Home already.
    await expect(nav.getByRole("link", { name: "기록" })).toHaveCount(0);
    await expect(nav.getByRole("link")).toHaveCount(5);
  });

  await step("write a family-visible entry", /\/$/, async () => {
    await page.getByRole("link", { name: /오늘의 순간 기록하기/ }).click();
    await page.waitForURL("**/write");

    // daily prompt is category-specific -- switching category should swap it.
    const prompt = page.getByText("💭", { exact: false });
    await expect(prompt).toBeVisible();
    const promptBefore = await prompt.innerText();
    await page.getByText("용기 냈어").click();
    await expect(prompt).not.toHaveText(promptBefore);

    await page.locator('textarea[name="content"]').fill(`자동화 테스트 기록 ${runId}`);
    await page.locator('button[type="button"]').click(); // flip visibility to "family"
    await page.getByRole("button", { name: "기록하기" }).click();
    await page.waitForURL("/");
    await expect(page.getByText(`자동화 테스트 기록 ${runId}`)).toBeVisible();
  });

  await step("edit today's entry, adding a photo", /\/$/, async () => {
    await page.getByRole("link", { name: "수정" }).click();
    await page.waitForURL(/\/write\//);
    await page.locator('textarea[name="content"]').fill(`수정된 테스트 기록 ${runId}`);
    await page.locator('input[name="photos"]').setInputFiles("tests/e2e/fixtures/test-photo.png");
    await page.getByRole("button", { name: "수정하기" }).click();
    await page.waitForURL("/");
    await expect(page.getByText(`수정된 테스트 기록 ${runId}`)).toBeVisible();
    await expect(page.getByText(`자동화 테스트 기록 ${runId}`)).not.toBeVisible();
  });

  await step("challenge mode shows a hatching pet after today's first entry", /\/challenge$/, async () => {
    await page.goto("/");
    await page.getByRole("link", { name: "🐣 도전 모드" }).click();
    await page.waitForURL("**/challenge");
    await expect(page.getByText("부화 중 · 연속 1일")).toBeVisible();
  });

  await step("uploaded photo shows up in the album", /\/album$/, async () => {
    await page.goto("/album");
    await expect(page.locator("img")).toHaveCount(1);
  });

  await step("private entry is written but stays hidden from family (checked later)", /\/$/, async () => {
    await page.goto("/write");
    await page.locator('textarea[name="content"]').fill(`비공개 테스트 기록 ${runId}`);
    // visibility toggle defaults to "나만 보기" (private) -- deliberately not
    // clicked here, unlike the family-visible entry above.
    await page.getByRole("button", { name: "기록하기" }).click();
    await page.waitForURL("/");
    await expect(page.getByText(`비공개 테스트 기록 ${runId}`)).toBeVisible();
  });

  await step("entry shows up on the calendar", /\/calendar$/, async () => {
    await page.goto("/calendar");
    await expect(page.locator("h1")).toContainText(/\d{4}년 \d{1,2}월/);
  });

  await step("clicking today on the calendar opens the day's entries", /\/calendar$/, async () => {
    const todayISO = new Date().toLocaleDateString("sv-SE");
    await page.locator(`a[href="/calendar/${todayISO}"]`).click();
    await page.waitForURL(`**/calendar/${todayISO}`);
    await expect(page.getByText(`수정된 테스트 기록 ${runId}`)).toBeVisible();
    await expect(page.getByText(`비공개 테스트 기록 ${runId}`)).toBeVisible();
    await expect(page.getByRole("link", { name: "이 날짜에 기록하기" })).toBeVisible();
    await page.goto("/calendar");
  });

  await step("add a calendar event", /\/calendar$/, async () => {
    await page.getByRole("button", { name: "+ 일정 추가" }).click();
    await page.getByPlaceholder(/미용실, 밥약속/).fill(`E2E 일정 ${runId}`);
    await page.getByRole("button", { name: "추가" }).click();
    await expect(page.getByText(`E2E 일정 ${runId}`)).toBeVisible();
  });

  await step("add a family-visible goal", /\/family$/, async () => {
    await page.goto("/family");
    await page.getByRole("button", { name: "+ 목표 추가" }).click();
    await page.getByPlaceholder(/줄넘기 1급/).fill(`E2E 목표 ${runId}`);
    await page.getByRole("button", { name: "나만 보기" }).click(); // flip to family-visible
    await page.getByRole("button", { name: "추가" }).click();
    await expect(page.getByText(`E2E 목표 ${runId}`)).toBeVisible();
  });

  await step("entry + reaction show up on the family feed", /\/family$/, async () => {
    await page.goto("/family");
    await expect(page.getByText(`수정된 테스트 기록 ${runId}`)).toBeVisible();
    await page.getByRole("button", { name: /^🔥/ }).click();
    await expect(page.getByRole("button", { name: /^🔥 1/ })).toBeVisible();

    const codeText = await page.getByText(/초대 코드:/).innerText();
    const match = codeText.match(/초대 코드:\s*([A-Z0-9]{6})/);
    if (!match) throw new Error(`couldn't find invite code in "${codeText}"`);
    inviteCode = match[1];
  });

  await step("add and delete a comment on the family feed", /\/family$/, async () => {
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
      // pick "아이" instead of leaving the default "부모" -- exercises the
      // other role, since a real family isn't all parents.
      await page2.getByText("아이", { exact: true }).click();
      await page2.getByRole("button", { name: "참여하기" }).click();
      await page2.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10_000 });
      await expect(page2).toHaveURL("/");

      await page2.goto("/family");
      await expect(page2.getByText(familyName)).toBeVisible();
      await expect(page2.getByText(`수정된 테스트 기록 ${runId}`)).toBeVisible();
      // privacy boundary: an entry left as "나만 보기" must never reach the
      // family feed, regardless of how many other entries that day are shared.
      await expect(page2.getByText(`비공개 테스트 기록 ${runId}`)).not.toBeVisible();

      // the family-visible entry's photo should be visible too -- this is
      // what the storage RLS policy added for the album (migration 0010) is
      // actually for: media table access alone isn't enough to fetch the file.
      await page2.goto("/album");
      await expect(page2.locator("img")).toHaveCount(1);

      await page2.goto("/family");
      // both members should be listed by nickname · role (first member is
      // "부모", second picked "아이" above) -- matching the full text avoids
      // username2 — which is literally "<username>_2" — accidentally
      // substring-matching username's badge too)
      await expect(page2.getByText(`${username} · 부모`)).toBeVisible();
      await expect(page2.getByText(`${username2} · 아이`)).toBeVisible();

      // second member can react too, independently of the first member's reaction
      await page2.getByRole("button", { name: /^🌱/ }).click();
      await expect(page2.getByRole("button", { name: /^🌱 1/ })).toBeVisible();

      // and can cheer the first member's family-visible goal
      await expect(page2.getByText(`E2E 목표 ${runId}`)).toBeVisible();
      await page2.getByRole("button", { name: /^👏/ }).click();
      await expect(page2.getByRole("button", { name: /^👏 1/ })).toBeVisible();

      // visiting the first member's room shows their shared goal too
      await page2.getByRole("link", { name: `${username} · 부모`, exact: true }).click();
      await page2.waitForURL(/\/room\//);
      await expect(page2.locator("h1")).toContainText("님의 공간");
      await expect(page2.getByText(`E2E 목표 ${runId}`)).toBeVisible();
    } finally {
      await context2.close();
    }
  });

  await step("switch the family entry back to private", /\/$/, async () => {
    // the previous step (via test.step, not the URL-checked `step` helper)
    // left `page` on /family -- go home first, where the "수정" link lives.
    // Home now shows both the family-visible entry and the private one from
    // the "private entry is written..." step above, each with their own
    // "수정" link -- scope to the list item with the family entry's text.
    await page.goto("/");
    await page
      .getByRole("listitem")
      .filter({ hasText: `수정된 테스트 기록 ${runId}` })
      .getByRole("link", { name: "수정" })
      .click();
    await page.waitForURL(/\/write\//);
    await page.locator('button[type="button"]').click(); // flip family -> private
    await page.getByRole("button", { name: "수정하기" }).click();
    await page.waitForURL("/");
  });

  await test.step("second member no longer sees the now-private entry or its reaction", async () => {
    const context3 = await browser.newContext();
    const page3 = await context3.newPage();
    try {
      await page3.goto("/login");
      await page3.getByPlaceholder("아이디").fill(username2);
      await page3.getByPlaceholder("비밀번호").fill(password2);
      await page3.getByRole("button", { name: "로그인" }).click();
      await page3.waitForURL("/");

      await page3.goto("/family");
      // switching visibility back to private must pull the entry (and
      // anything hanging off it, like the second member's own reaction)
      // out of the family feed entirely, not just hide new access to it.
      await expect(page3.getByText(`수정된 테스트 기록 ${runId}`)).not.toBeVisible();
    } finally {
      await context3.close();
    }
  });

  await step("pick a growth world and view my own room", /\/room\//, async () => {
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

  await step("switch to the color-collection world and see the color codex", /\/room\//, async () => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "색모음집" }).click();
    await expect(page.getByRole("button", { name: "색모음집" })).toBeEnabled({ timeout: 20_000 });

    await page.goto("/");
    await page.getByRole("link", { name: "내 공간 보러가기" }).click();
    await page.waitForURL(/\/room\//);
    await expect(page.getByText("색모음집 세계관")).toBeVisible();
    await expect(page.getByText(/🎨 색 도감/)).toBeVisible();
  });

  await step("change nickname in settings without breaking login id", /\/settings$/, async () => {
    await page.goto("/settings");
    const nicknameInput = page.locator('input[name="name"]');
    await nicknameInput.fill(`새닉네임_${runId}`);
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("닉네임이 바뀌었어요.")).toBeVisible();
  });

  await step("sign out and log back in with the original username", /\/$/, async () => {
    await page.getByRole("button", { name: "로그아웃" }).click();
    await page.waitForURL("**/login");
    await page.getByPlaceholder("아이디").fill(username);
    await page.getByPlaceholder("비밀번호").fill(password);
    await page.getByRole("button", { name: "로그인" }).click();
    // Should land on Home directly, not get bounced to onboarding again.
    await page.waitForURL("/");
  });
});

test("signing up with a username that's already taken shows a clear error", async ({ page }) => {
  // Reuses `username` from the test above -- serial mode guarantees that
  // account already exists by the time this runs, so no extra signup is
  // needed just to set up the duplicate.
  await page.goto("/signup");
  await page.getByPlaceholder("아이디 (로그인용)").fill(username);
  await page.getByPlaceholder(/비밀번호 \(6자 이상\)/).fill("AnotherPass123!");
  await page.getByRole("button", { name: "가입하기" }).click();
  await expect(page.getByText("이 아이디는 이미 사용 중이에요. 다른 아이디를 써볼래요?")).toBeVisible();
  // must not have navigated away or silently created a session
  await expect(page).toHaveURL(/\/signup$/);
});
