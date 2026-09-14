// Deterministic reward items — no randomness/gacha (explicitly ruled out
// by the product's game-design principles). Every item unlocks from a
// fixed, visible rule based on the user's own cumulative activity.
export type ItemStats = {
  categoryCounts: Record<string, number>;
  achievedGoals: number;
  cheersReceived: number;
  entryDays: number;
};

export type Item = {
  id: string;
  emoji: string;
  label: string;
  hint: string;
  isUnlocked: (stats: ItemStats) => boolean;
};

export const ITEMS: Item[] = [
  { id: "first-goal", emoji: "🏆", label: "첫 목표 달성", hint: "목표를 하나 달성하면", isUnlocked: (s) => s.achievedGoals >= 1 },
  { id: "goal-3", emoji: "🥇", label: "목표 3개 달성", hint: "목표 3개를 달성하면", isUnlocked: (s) => s.achievedGoals >= 3 },
  { id: "cheer-10", emoji: "🎉", label: "응원 10번 받기", hint: "가족에게 응원을 10번 받으면", isUnlocked: (s) => s.cheersReceived >= 10 },
  { id: "achieved-5", emoji: "⭐", label: "해냈어 x5", hint: "'해냈어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.achieved ?? 0) >= 5 },
  { id: "brave-5", emoji: "🔥", label: "용기 냈어 x5", hint: "'용기 냈어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.brave ?? 0) >= 5 },
  { id: "discovered-5", emoji: "🔍", label: "발견했어 x5", hint: "'발견했어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.discovered ?? 0) >= 5 },
  { id: "grateful-5", emoji: "💛", label: "고마워 x5", hint: "'고마워' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.grateful ?? 0) >= 5 },
  { id: "growing-5", emoji: "🌱", label: "자라고 있어 x5", hint: "'자라고 있어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.growing ?? 0) >= 5 },
  { id: "days-10", emoji: "📅", label: "10일 기록", hint: "서로 다른 10일 동안 기록하면", isUnlocked: (s) => s.entryDays >= 10 },
  { id: "days-30", emoji: "🗓️", label: "30일 기록", hint: "서로 다른 30일 동안 기록하면", isUnlocked: (s) => s.entryDays >= 30 },
];
