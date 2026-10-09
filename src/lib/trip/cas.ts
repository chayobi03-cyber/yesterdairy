// 낙관적 잠금(compare-and-swap)용 버전 값. 행의 updated_at을 버전으로 쓴다:
// "읽은 updated_at과 같을 때만 쓴다" -> 다른 사람이 먼저 저장했다면 0행이 갱신되고,
// 호출자가 최신 데이터를 다시 읽어 같은 변경을 다시 적용한다 (마지막 저장이 앞사람
// 변경을 지우는 일을 막는다).
//
// 새 버전은 반드시 이전 버전보다 엄격히 커야 한다 (같은 밀리초에 두 번 저장돼도
// 버전이 겹치지 않도록). DB에는 마이크로초 정밀도로 저장될 수 있어, 이전 값을
// 밀리초로 파싱한 뒤 +1ms 한다.
export function nextVersion(prev: string | null | undefined, nowMs: number): string {
  const prevMs = prev ? Date.parse(prev) : Number.NaN;
  const floor = Number.isNaN(prevMs) ? nowMs : prevMs + 1;
  return new Date(Math.max(nowMs, floor)).toISOString();
}

// 충돌 시 최신 데이터로 다시 시도하는 최대 횟수
export const MAX_CAS_ATTEMPTS = 5;

export const CONFLICT_MESSAGE = "다른 가족이 동시에 수정하고 있어요. 잠시 후 다시 시도해주세요.";
