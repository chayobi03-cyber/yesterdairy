import type { CategoryValue } from "@/lib/categories";

// Category-specific daily prompts -- helps with the blank-page problem
// without any external API. Selection is deterministic (date + category
// hashed together), same pattern used everywhere else for "which X do we
// show" decisions, so a given category shows the same prompt all day and
// a different one tomorrow -- no randomness, no dopamine-slot-machine feel.
const PROMPTS: Record<CategoryValue, string[]> = {
  achieved: [
    "오늘 스스로가 대견했던 순간은?",
    "작았지만 뿌듯했던 일이 있었나요?",
    "미뤄뒀던 일을 하나라도 해냈다면?",
    "오늘 목표에 한 걸음 다가간 게 있다면?",
    "누군가 몰라줘도 나는 아는 나의 노력은?",
  ],
  brave: [
    "오늘 조금 무서웠지만 시도한 일이 있나요?",
    "평소라면 피했을 텐데 오늘은 해본 것은?",
    "먼저 말을 걸거나 다가간 순간이 있었나요?",
    "실패할까 걱정됐지만 해본 일은?",
    "낯선 걸 시도해본 순간이 있었나요?",
  ],
  discovered: [
    "오늘 새롭게 알게 된 건 뭔가요?",
    "'아, 이런 거였구나' 싶었던 순간은?",
    "몰랐던 나 자신의 모습을 발견했나요?",
    "오늘 배운 것 중 기억하고 싶은 건?",
    "누군가에게 배운 게 있었나요?",
  ],
  grateful: [
    "오늘 누구에게 가장 고마웠나요?",
    "당연하게 여겼는데 사실 감사한 건?",
    "작은 친절을 받은 순간이 있었나요?",
    "오늘 나를 웃게 한 사람은 누구인가요?",
    "곁에 있어 감사한 사람을 떠올려볼까요?",
  ],
  growing: [
    "오늘 조금 더 나아진 부분이 있다면?",
    "다음엔 이렇게 해봐야겠다 싶은 게 있었나요?",
    "어제보다 나아진 걸 하나 꼽는다면?",
    "요즘 꾸준히 하고 있는 게 있나요?",
    "다음 목표로 삼고 싶은 건 뭔가요?",
  ],
};

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function todayPrompt(category: CategoryValue, dateISO: string): string {
  const list = PROMPTS[category];
  return list[hash(`${dateISO}:${category}`) % list.length];
}
