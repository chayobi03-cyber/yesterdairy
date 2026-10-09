import path from "node:path";
import { defineConfig } from "vitest/config";

// 단위/컴포넌트 테스트는 DB·브라우저 없이 도는 것만 대상으로 한다 (src/lib/trip 순수 로직과
// 여행 화면의 상호작용). E2E는 Playwright(tests/e2e)가 따로 맡는다.
// 컴포넌트 테스트 파일은 맨 위에 `// @vitest-environment jsdom`을 적는다.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: { include: ["tests/unit/**/*.test.{ts,tsx}"], environment: "node" },
});
