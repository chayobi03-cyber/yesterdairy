// A curated palette with Korean names, used two ways: (1) picking "오늘의
// 미션" -- the color of the day to hunt for -- and (2) naming whatever
// color a photo actually comes out to. Deterministic everywhere (hash the
// date, or the captured hex, into an index) -- no Math.random(), same
// pattern as lib/colors.ts / lib/prompts.ts.
export const NAMED_COLORS: { name: string; hex: string }[] = [
  { name: "계곡물", hex: "#86C9C0" },
  { name: "새벽하늘", hex: "#8FA8D6" },
  { name: "벚꽃잎", hex: "#F4C2C2" },
  { name: "가을낙엽", hex: "#C97C3D" },
  { name: "숲그늘", hex: "#4C6E4E" },
  { name: "민트초코", hex: "#A8D8C9" },
  { name: "레몬에이드", hex: "#F3E27A" },
  { name: "노을", hex: "#F2946B" },
  { name: "라벤더밭", hex: "#B7A6D9" },
  { name: "먹구름", hex: "#6E7178" },
  { name: "우유거품", hex: "#F5F0E6" },
  { name: "산호초", hex: "#F07E6E" },
  { name: "바다한가운데", hex: "#2E6E8E" },
  { name: "복숭아", hex: "#F5B79B" },
  { name: "이끼", hex: "#7C8B5B" },
  { name: "체리", hex: "#B8324D" },
  { name: "겨울아침", hex: "#D9E3EA" },
  { name: "은행잎", hex: "#E8B93A" },
  { name: "자몽", hex: "#E8664E" },
  { name: "청포도", hex: "#B7C96A" },
  { name: "커피우유", hex: "#B08968" },
  { name: "밤하늘", hex: "#232B4A" },
  { name: "민들레", hex: "#F0C93A" },
  { name: "장미정원", hex: "#C3427A" },
  { name: "잔잔한 호수", hex: "#5E93A0" },
  { name: "흙길", hex: "#8B6A4F" },
  { name: "구름", hex: "#E9EDF2" },
  { name: "올리브", hex: "#6B6E3A" },
  { name: "자두", hex: "#5B3A5C" },
  { name: "산딸기", hex: "#C0446B" },
  { name: "말차", hex: "#8FA05C" },
  { name: "모래사장", hex: "#E3CDA4" },
  { name: "짙은 남색", hex: "#2C3E6B" },
  { name: "코스모스", hex: "#E9A4C2" },
  { name: "감귤", hex: "#EF9B3D" },
  { name: "대나무숲", hex: "#5C8B6E" },
  { name: "라일락", hex: "#C9A8D4" },
  { name: "고동색 가죽", hex: "#6B4226" },
  { name: "물안개", hex: "#C7D6DA" },
  { name: "붉은 벽돌", hex: "#9C4A3C" },
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// Same target color for every family member on a given day -- a shared
// daily hunt, not a per-user one.
export function todayMission(dateISO: string): { hex: string; name: string } {
  return NAMED_COLORS[hash(`mission:${dateISO}`) % NAMED_COLORS.length];
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function nearestColorName(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  let best = NAMED_COLORS[0];
  let bestDist = Infinity;
  for (const c of NAMED_COLORS) {
    const [cr, cg, cb] = hexToRgb(c.hex);
    const dist = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  return best.name;
}

// 0-100: how close `hex` is to `targetHex`, by RGB Euclidean distance
// normalized against the maximum possible distance (black vs. white).
export function matchPercent(hex: string, targetHex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const [tr, tg, tb] = hexToRgb(targetHex);
  const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2);
  const maxDist = Math.sqrt(255 ** 2 * 3);
  return Math.round(100 * (1 - dist / maxDist));
}
