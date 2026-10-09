import { defineConfig } from "vitest/config";

// 단위 테스트는 DB/브라우저 없이 도는 순수 로직(src/lib/trip)만 대상으로 한다.
// E2E는 Playwright(tests/e2e)가 따로 맡는다.
export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
});
