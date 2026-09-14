// Fixed palette for the "색모음집" world -- which color a given item unlocks
// is a deterministic hash of the item's own id (same pickCreature approach
// used everywhere else), so a specific achievement always reveals the same
// color, no randomness.
export type ColorEntry = {
  name: string;
  hex: string;
  meaning: string;
  like: string;
};

export const COLORS: ColorEntry[] = [
  { name: "하늘파랑", hex: "#8ecae6", meaning: "맑고 시원한 느낌", like: "하늘 · 구름" },
  { name: "새싹초록", hex: "#95d5a1", meaning: "막 돋아난 생기", like: "새싹 · 봄" },
  { name: "햇살노랑", hex: "#ffd166", meaning: "따뜻하고 밝은 느낌", like: "햇빛 · 병아리" },
  { name: "노을주황", hex: "#ff9a5a", meaning: "하루를 마무리하는 포근함", like: "노을 · 감" },
  { name: "벚꽃분홍", hex: "#ffb6c1", meaning: "설레고 부드러운 느낌", like: "벚꽃 · 솜사탕" },
  { name: "라벤더보라", hex: "#c3aed6", meaning: "차분하고 은은한 느낌", like: "라벤더 · 저녁하늘" },
  { name: "숲초록", hex: "#4a8c6f", meaning: "깊고 안정된 느낌", like: "숲 · 이끼" },
  { name: "사과빨강", hex: "#e8594a", meaning: "생기있고 씩씩한 느낌", like: "사과 · 딸기" },
  { name: "깊은바다파랑", hex: "#2a6f97", meaning: "신비롭고 깊은 느낌", like: "깊은 바다" },
  { name: "구름하양", hex: "#f4f1ea", meaning: "가볍고 순수한 느낌", like: "구름 · 솜" },
  { name: "밤하늘남색", hex: "#2b2a4a", meaning: "고요하고 신비로운 느낌", like: "밤 · 우주" },
  { name: "비구름회색", hex: "#a8a8a8", meaning: "차분히 가라앉는 느낌", like: "비 오는 하늘" },
];

export function pickColorIndex(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % COLORS.length;
}
