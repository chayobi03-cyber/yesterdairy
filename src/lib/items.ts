// Deterministic reward items — no randomness/gacha (explicitly ruled out
// by the product's game-design principles). Every item unlocks from a
// fixed, visible rule based on the user's own cumulative activity.
export type ItemStats = {
  categoryCounts: Record<string, number>;
  achievedGoals: number;
  cheersReceived: number;
  cheersGiven: number;
  entryDays: number;
  totalEntries: number;
};

export type Item = {
  id: string;
  emoji: string;
  label: string;
  hint: string;
  isUnlocked: (stats: ItemStats) => boolean;
};

export const ITEMS: Item[] = [
  // 목표 달성
  { id: "first-goal", emoji: "🏆", label: "첫 목표 달성", hint: "목표를 하나 달성하면", isUnlocked: (s) => s.achievedGoals >= 1 },
  { id: "goal-3", emoji: "🥇", label: "목표 3개 달성", hint: "목표 3개를 달성하면", isUnlocked: (s) => s.achievedGoals >= 3 },
  { id: "goal-10", emoji: "🏅", label: "목표 10개 달성", hint: "목표 10개를 달성하면", isUnlocked: (s) => s.achievedGoals >= 10 },
  { id: "goal-25", emoji: "👑", label: "목표 25개 달성", hint: "목표 25개를 달성하면", isUnlocked: (s) => s.achievedGoals >= 25 },

  // 응원받기 / 응원하기
  { id: "cheer-received-10", emoji: "🎉", label: "응원 10번 받기", hint: "가족에게 응원을 10번 받으면", isUnlocked: (s) => s.cheersReceived >= 10 },
  { id: "cheer-received-30", emoji: "🎊", label: "응원 30번 받기", hint: "가족에게 응원을 30번 받으면", isUnlocked: (s) => s.cheersReceived >= 30 },
  { id: "cheer-received-100", emoji: "🌟", label: "응원 100번 받기", hint: "가족에게 응원을 100번 받으면", isUnlocked: (s) => s.cheersReceived >= 100 },
  { id: "cheer-given-10", emoji: "👏", label: "응원단장", hint: "가족을 10번 응원하면", isUnlocked: (s) => s.cheersGiven >= 10 },
  { id: "cheer-given-30", emoji: "📣", label: "우리 가족 치어리더", hint: "가족을 30번 응원하면", isUnlocked: (s) => s.cheersGiven >= 30 },

  // 카테고리별 기록 (5 / 15 / 30)
  { id: "achieved-5", emoji: "⭐", label: "해냈어 x5", hint: "'해냈어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.achieved ?? 0) >= 5 },
  { id: "achieved-15", emoji: "🌟", label: "해냈어 x15", hint: "'해냈어' 기록을 15개 쓰면", isUnlocked: (s) => (s.categoryCounts.achieved ?? 0) >= 15 },
  { id: "achieved-30", emoji: "💫", label: "해냈어 x30", hint: "'해냈어' 기록을 30개 쓰면", isUnlocked: (s) => (s.categoryCounts.achieved ?? 0) >= 30 },
  { id: "brave-5", emoji: "🔥", label: "용기 냈어 x5", hint: "'용기 냈어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.brave ?? 0) >= 5 },
  { id: "brave-15", emoji: "🚀", label: "용기 냈어 x15", hint: "'용기 냈어' 기록을 15개 쓰면", isUnlocked: (s) => (s.categoryCounts.brave ?? 0) >= 15 },
  { id: "brave-30", emoji: "🦁", label: "용기 냈어 x30", hint: "'용기 냈어' 기록을 30개 쓰면", isUnlocked: (s) => (s.categoryCounts.brave ?? 0) >= 30 },
  { id: "discovered-5", emoji: "🔍", label: "발견했어 x5", hint: "'발견했어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.discovered ?? 0) >= 5 },
  { id: "discovered-15", emoji: "🔭", label: "발견했어 x15", hint: "'발견했어' 기록을 15개 쓰면", isUnlocked: (s) => (s.categoryCounts.discovered ?? 0) >= 15 },
  { id: "discovered-30", emoji: "🧭", label: "발견했어 x30", hint: "'발견했어' 기록을 30개 쓰면", isUnlocked: (s) => (s.categoryCounts.discovered ?? 0) >= 30 },
  { id: "grateful-5", emoji: "💛", label: "고마워 x5", hint: "'고마워' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.grateful ?? 0) >= 5 },
  { id: "grateful-15", emoji: "💝", label: "고마워 x15", hint: "'고마워' 기록을 15개 쓰면", isUnlocked: (s) => (s.categoryCounts.grateful ?? 0) >= 15 },
  { id: "grateful-30", emoji: "💖", label: "고마워 x30", hint: "'고마워' 기록을 30개 쓰면", isUnlocked: (s) => (s.categoryCounts.grateful ?? 0) >= 30 },
  { id: "growing-5", emoji: "🌱", label: "자라고 있어 x5", hint: "'자라고 있어' 기록을 5개 쓰면", isUnlocked: (s) => (s.categoryCounts.growing ?? 0) >= 5 },
  { id: "growing-15", emoji: "🌿", label: "자라고 있어 x15", hint: "'자라고 있어' 기록을 15개 쓰면", isUnlocked: (s) => (s.categoryCounts.growing ?? 0) >= 15 },
  { id: "growing-30", emoji: "🌳", label: "자라고 있어 x30", hint: "'자라고 있어' 기록을 30개 쓰면", isUnlocked: (s) => (s.categoryCounts.growing ?? 0) >= 30 },

  // 기록한 날 수
  { id: "days-10", emoji: "📅", label: "10일 기록", hint: "서로 다른 10일 동안 기록하면", isUnlocked: (s) => s.entryDays >= 10 },
  { id: "days-30", emoji: "🗓️", label: "30일 기록", hint: "서로 다른 30일 동안 기록하면", isUnlocked: (s) => s.entryDays >= 30 },
  { id: "days-60", emoji: "📖", label: "60일 기록", hint: "서로 다른 60일 동안 기록하면", isUnlocked: (s) => s.entryDays >= 60 },
  { id: "days-100", emoji: "📚", label: "100일 기록", hint: "서로 다른 100일 동안 기록하면", isUnlocked: (s) => s.entryDays >= 100 },

  // 전체 기록 개수
  { id: "entries-20", emoji: "✏️", label: "기록 20개", hint: "전체 기록 20개를 쓰면", isUnlocked: (s) => s.totalEntries >= 20 },
  { id: "entries-50", emoji: "📔", label: "기록 50개", hint: "전체 기록 50개를 쓰면", isUnlocked: (s) => s.totalEntries >= 50 },
  { id: "entries-100", emoji: "📗", label: "기록 100개", hint: "전체 기록 100개를 쓰면", isUnlocked: (s) => s.totalEntries >= 100 },

  // 골고루 (다섯 카테고리 모두 한 번씩)
  {
    id: "all-categories",
    emoji: "🎨",
    label: "다섯 빛깔",
    hint: "다섯 종류 기록을 모두 한 번씩 써보면",
    isUnlocked: (s) =>
      ["achieved", "brave", "discovered", "grateful", "growing"].every((c) => (s.categoryCounts[c] ?? 0) >= 1),
  },
];
