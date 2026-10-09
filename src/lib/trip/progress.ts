// 장소별 진행 기록의 순수 로직. 서버 액션이 최신 행을 읽어 이 함수를 적용한다.
import type { ProgressStatus } from "./types";

export type ProgressState = {
  status: ProgressStatus | null;
  checks: Record<string, boolean>;
  memo: string;
  cost: number | null;
};

export type ProgressPatch = Partial<{
  status: ProgressStatus | null;
  checkIndex: number;
  checked: boolean;
  memo: string;
  cost: number | null;
}>;

export const EMPTY_PROGRESS: ProgressState = { status: null, checks: {}, memo: "", cost: null };

export function applyProgressPatch(
  cur: ProgressState,
  patch: ProgressPatch,
): { ok: true; state: ProgressState } | { ok: false; error: string } {
  const next: ProgressState = { ...cur, checks: { ...cur.checks } };

  if ("status" in patch) {
    if (patch.status != null && !["arrived", "done", "skipped"].includes(patch.status)) return { ok: false, error: "잘못된 상태예요." };
    next.status = patch.status ?? null;
  }
  if (patch.checkIndex != null) {
    if (!Number.isInteger(patch.checkIndex) || patch.checkIndex < 0 || patch.checkIndex > 50) return { ok: false, error: "잘못된 체크 항목이에요." };
    next.checks[String(patch.checkIndex)] = !!patch.checked;
  }
  if ("memo" in patch) {
    if ((patch.memo ?? "").length > 2000) return { ok: false, error: "메모는 2000자까지 쓸 수 있어요." };
    next.memo = patch.memo ?? "";
  }
  if ("cost" in patch) {
    if (patch.cost != null && !(Number.isInteger(patch.cost) && patch.cost >= 0 && patch.cost <= 100_000_000)) {
      return { ok: false, error: "지출은 0 이상의 정수로 입력해주세요." };
    }
    next.cost = patch.cost ?? null;
  }
  return { ok: true, state: next };
}
