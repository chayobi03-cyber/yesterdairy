// 장소별 댓글의 순수 로직 (DB/DOM 비의존).
import type { TripComment } from "./types";

export const MAX_COMMENT_LEN = 1000;
export const MAX_COMMENTS_PER_TRIP = 500;

export function checkCommentBody(raw: string): { ok: true; body: string } | { ok: false; error: string } {
  const body = raw.trim();
  if (!body) return { ok: false, error: "댓글 내용을 입력해주세요." };
  if (body.length > MAX_COMMENT_LEN) return { ok: false, error: `댓글은 ${MAX_COMMENT_LEN}자까지 쓸 수 있어요.` };
  return { ok: true, body };
}

// 쓴 사람 또는 여행을 만든 사람만 지울 수 있다 (DB 삭제 정책과 같은 규칙)
export const canDeleteComment = (c: TripComment, viewerId: string, isCreator: boolean) => isCreator || c.createdBy === viewerId;

// 한국 시간(KST)으로 "10/10 14:05" 형식. 서버/브라우저 시간대와 상관없이 같은 결과.
export function formatCommentTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

// 여행 시작일과 "오늘"(뷰어의 로컬 날짜)로 처음 열 날짜를 정한다. 범위 밖이면 가장 가까운 날.
export function dayForDate(startDate: string | null, today: string, dayCount: number): number {
  if (!startDate || dayCount < 1) return 1;
  const a = Date.parse(`${startDate}T00:00:00Z`);
  const b = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 1;
  const n = Math.round((b - a) / 86_400_000) + 1;
  return Math.min(dayCount, Math.max(1, n));
}
