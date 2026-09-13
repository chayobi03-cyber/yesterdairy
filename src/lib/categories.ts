export const CATEGORIES = [
  { value: "achieved", emoji: "⭐", label: "해냈어", hint: "내가 해낸 것" },
  { value: "brave", emoji: "🔥", label: "용기 냈어", hint: "어려웠지만 시도한 것" },
  { value: "discovered", emoji: "🔍", label: "발견했어", hint: "새롭게 알게 된 것" },
  { value: "grateful", emoji: "💛", label: "고마워", hint: "감사했던 것" },
  { value: "growing", emoji: "🌱", label: "자라고 있어", hint: "배우고 다음을 찾은 것" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export function categoryMeta(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[0];
}
