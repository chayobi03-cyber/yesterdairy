export const PET_STAGE_LABELS = ["알", "부화 중", "아기", "새끼", "다 자람", "반짝반짝"] as const;

export function petStageFor(streak: number): number {
  if (streak <= 0) return 0;
  if (streak <= 2) return 1;
  if (streak <= 6) return 2;
  if (streak <= 13) return 3;
  if (streak <= 29) return 4;
  return 5;
}

// Days needed to reach the *next* stage, or null once maxed out -- used to
// show "n일 더 기록하면 다음 단계예요" instead of just the raw streak number.
export function daysUntilNextStage(streak: number): number | null {
  const thresholds = [1, 3, 7, 14, 30];
  const next = thresholds.find((t) => streak < t);
  return next === undefined ? null : next - streak;
}
