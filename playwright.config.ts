import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  // This test walks through the whole app in one long flow (now 15+ steps
  // after color world, editing, comments, album, etc. were added on top of
  // the original), each step a real round trip to Supabase -- 30s stopped
  // being enough headroom and started failing at whatever step happened to
  // be in flight when ordinary network latency landed, not from any actual
  // bug in the step itself.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // The color-hunt camera (getUserMedia) needs a real permission
        // grant + video source to test headlessly. These two flags make
        // Chromium auto-accept the camera prompt and feed it a synthetic
        // video pattern instead of prompting for/using a real webcam.
        launchOptions: {
          args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
        },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run start -- -p ${PORT}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
