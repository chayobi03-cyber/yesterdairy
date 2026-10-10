import { describe, expect, it } from "vitest";
import { MAX_COMMENT_LEN, canDeleteComment, checkCommentBody, dayForDate, formatCommentTime } from "../../src/lib/trip/comments";

describe("checkCommentBody", () => {
  it("앞뒤 공백을 지우고, 빈 글과 너무 긴 글은 거부", () => {
    expect(checkCommentBody("  안녕  ")).toEqual({ ok: true, body: "안녕" });
    expect(checkCommentBody("   ").ok).toBe(false);
    expect(checkCommentBody("가".repeat(MAX_COMMENT_LEN)).ok).toBe(true);
    expect(checkCommentBody("가".repeat(MAX_COMMENT_LEN + 1)).ok).toBe(false);
  });
});

describe("canDeleteComment", () => {
  const c = { id: "c", itemId: "i", body: "b", createdBy: "u1", authorName: "나", createdAt: "" };
  it("쓴 사람 또는 여행을 만든 사람만", () => {
    expect(canDeleteComment(c, "u1", false)).toBe(true);
    expect(canDeleteComment(c, "u2", false)).toBe(false);
    expect(canDeleteComment(c, "u2", true)).toBe(true);
  });
});

describe("formatCommentTime", () => {
  it("서버/브라우저 시간대와 상관없이 한국 시간(KST)으로 표시", () => {
    expect(formatCommentTime("2026-10-10T01:05:00Z")).toBe("10/10 10:05");
    expect(formatCommentTime("2026-10-10T15:30:00Z")).toBe("10/11 00:30"); // 날짜가 넘어간다
  });
  it("잘못된 값은 빈 문자열", () => {
    expect(formatCommentTime("not-a-date")).toBe("");
  });
});

describe("dayForDate (열 때 보여줄 날)", () => {
  it("여행 기간 안이면 오늘이 몇 일차인지", () => {
    expect(dayForDate("2026-10-10", "2026-10-10", 2)).toBe(1);
    expect(dayForDate("2026-10-10", "2026-10-11", 2)).toBe(2);
  });
  it("여행 전이면 1일차, 끝났으면 마지막 날", () => {
    expect(dayForDate("2026-10-10", "2026-10-01", 2)).toBe(1);
    expect(dayForDate("2026-10-10", "2026-11-01", 2)).toBe(2);
  });
  it("시작일이 없거나 형식이 틀리면 1일차", () => {
    expect(dayForDate(null, "2026-10-10", 3)).toBe(1);
    expect(dayForDate("x", "2026-10-10", 3)).toBe(1);
    expect(dayForDate("2026-10-10", "2026-10-10", 0)).toBe(1);
  });
});
