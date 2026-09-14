import { TREE_CREATURES, CONSTELLATION_CREATURES, PLANET_CREATURES, pickCreature } from "@/lib/creatures";

// Each world is a small "collection" scene: unlocked items show up as
// actual illustrated creatures (species picked deterministically from the
// item's own id, see lib/creatures.tsx) scattered across a themed backdrop,
// instead of plain dots -- the "동물원처럼 모으기" request. To stay legible,
// only the first CREATURE_CAP items render as full creatures; beyond that,
// remaining ones fall back to small plain marks (still visible, just not
// individually detailed) so a big collection doesn't turn into visual noise.
//
// All positions come from the index via sin/cos (phyllotaxis / sunflower-
// seed packing), never Math.random, so SSR and hydration match.

const CREATURE_CAP = 10;
const GOLDEN_ANGLE = 2.399963229728653;

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function phyllotaxis(count: number, rx: number, ry: number, cx: number, cy: number) {
  return Array.from({ length: count }, (_, i) => {
    const idx = i + 1;
    const frac = Math.sqrt(idx / count);
    const angle = idx * GOLDEN_ANGLE;
    return { x: cx + Math.cos(angle) * rx * frac, y: cy + Math.sin(angle) * ry * frac };
  });
}

export function WorldView({ worldType, itemIds }: { worldType: string; itemIds: string[] }) {
  if (worldType === "constellation") return <ConstellationScene itemIds={itemIds} />;
  if (worldType === "planet") return <PlanetScene itemIds={itemIds} />;
  return <TreeScene itemIds={itemIds} />;
}

function ConstellationScene({ itemIds }: { itemIds: string[] }) {
  const count = itemIds.length;
  const pts = phyllotaxis(Math.min(count, 40) || 1, 92, 48, 110, 60);

  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "radial-gradient(120% 100% at 30% 20%, #2c2264 0%, #17123a 60%, #100c2b 100%)" }}
    >
      {count > 0 && (
        <svg viewBox="0 0 220 120" className="h-full w-full">
          <defs>
            <filter id="star-glow">
              <feGaussianBlur stdDeviation="1.1" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {pts.map((p, i) =>
            i < CREATURE_CAP ? (
              <g key={i}>{pickCreature(CONSTELLATION_CREATURES, itemIds[i])(p.x, p.y, 7)}</g>
            ) : (
              <circle key={i} cx={p.x} cy={p.y} r={i % 6 === 0 ? 2.6 : 1.3} fill="#fff" filter="url(#star-glow)" opacity={0.95}>
                <animate attributeName="opacity" values="0.55;1;0.55" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
              </circle>
            ),
          )}
        </svg>
      )}
      <Caption count={count} label="마리의 별친구" light />
    </div>
  );
}

function PlanetScene({ itemIds }: { itemIds: string[] }) {
  const count = itemIds.length;
  const pts = phyllotaxis(Math.min(count, 40) || 1, 92, 44, 110, 62);

  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "linear-gradient(180deg, #eef0ff 0%, #dde6ff 60%, #cfe0ff 100%)" }}
    >
      <svg viewBox="0 0 220 120" className="h-full w-full">
        <circle cx={182} cy={26} r={12} fill="#ffd9a8" opacity={0.9} />
        <ellipse cx={182} cy={26} rx={20} ry={5} fill="none" stroke="#ffb877" strokeWidth={1.6} opacity={0.7} transform="rotate(-15 182 26)" />
        <circle cx={30} cy={20} r={2.6} fill="#fff" opacity={0.6} />
        <circle cx={46} cy={34} r={1.8} fill="#fff" opacity={0.5} />
        {count > 0 &&
          pts.map((p, i) =>
            i < CREATURE_CAP ? (
              <g key={i}>{pickCreature(PLANET_CREATURES, itemIds[i])(p.x, p.y, 7)}</g>
            ) : (
              <circle key={i} cx={p.x} cy={p.y} r={2.2} fill="var(--accent-400)" opacity={0.7} />
            ),
          )}
      </svg>
      <Caption count={count} label="마리의 외계 친구" />
    </div>
  );
}

function TreeScene({ itemIds }: { itemIds: string[] }) {
  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "linear-gradient(180deg, #f3faf4 0%, #e4f3e7 100%)" }}
    >
      <TreeStage itemIds={itemIds} />
    </div>
  );
}

// Grows through stages instead of jumping straight to a full canopy: bare
// seed -> sprout with a leaf or two -> sapling with a small canopy -> mature
// tree whose canopy/trunk keep thickening and which visiting animals start
// to populate. Still purely a function of itemIds.length, no randomness.
function TreeStage({ itemIds }: { itemIds: string[] }) {
  const itemCount = itemIds.length;
  const soil = <ellipse cx={110} cy={108} rx={30} ry={5} fill="#000" opacity={0.06} />;
  const gradients = (
    <defs>
      <radialGradient id="canopy" cx="42%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#bfe6c8" />
        <stop offset="100%" stopColor="#8fcf9e" />
      </radialGradient>
      <linearGradient id="trunk" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#b78d63" />
        <stop offset="100%" stopColor="#8f6a48" />
      </linearGradient>
    </defs>
  );

  if (itemCount <= 0) {
    return (
      <>
        <svg viewBox="0 0 220 120" className="h-full w-full">
          {gradients}
          {soil}
          <path d="M110 108 C109 100 111 96 110 90" stroke="url(#trunk)" strokeWidth={3} strokeLinecap="round" fill="none" />
          <ellipse cx={103} cy={92} rx={6} ry={4} fill="#8fcf9e" transform="rotate(-30 103 92)" />
          <ellipse cx={117} cy={90} rx={6} ry={4} fill="#8fcf9e" transform="rotate(30 117 90)" />
        </svg>
        <Caption text="씨앗을 심었어요" />
      </>
    );
  }

  if (itemCount <= 2) {
    const leaves = [
      <ellipse key="l1" cx={100} cy={86} rx={9} ry={5.5} fill="#8fcf9e" transform="rotate(-35 100 86)" />,
      <ellipse key="l2" cx={121} cy={78} rx={9} ry={5.5} fill="#a3dcae" transform="rotate(30 121 78)" />,
    ].slice(0, itemCount);
    return (
      <>
        <svg viewBox="0 0 220 120" className="h-full w-full">
          {gradients}
          {soil}
          <path d="M110 108 C108 96 111 88 110 72" stroke="url(#trunk)" strokeWidth={3.5} strokeLinecap="round" fill="none" />
          {leaves}
        </svg>
        <Caption text="새싹이 돋았어요" />
      </>
    );
  }

  if (itemCount <= 6) {
    const dots = phyllotaxis(itemCount, 22, 15, 110, 62);
    return (
      <>
        <svg viewBox="0 0 220 120" className="h-full w-full">
          {gradients}
          {soil}
          <path d="M110 108 C109 92 110 80 110 68" stroke="url(#trunk)" strokeWidth={4} strokeLinecap="round" fill="none" />
          <ellipse cx={110} cy={60} rx={28} ry={19} fill="url(#canopy)" />
          {dots.map((d, i) => (
            <circle key={i} cx={d.x} cy={d.y} r={3} fill="#6fc182" opacity={0.9} />
          ))}
        </svg>
        <Caption text="무럭무럭 자라는 중" />
      </>
    );
  }

  const t = clamp((itemCount - 7) / 33, 0, 1);
  const trunkW = lerp(5, 9, t);
  const canopyRx = lerp(38, 58, t);
  const canopyRy = lerp(24, 38, t);
  const canopyCy = lerp(56, 48, t);
  const trunkTop = canopyCy + canopyRy * 0.35;
  const pts = phyllotaxis(Math.min(itemCount, 40), canopyRx * 0.85, canopyRy * 0.8, 110, canopyCy);
  // The canopy starts small, so cramming up to CREATURE_CAP full-size
  // creatures into it early on just overlaps -- ramp the visible count with
  // the same growth progress t instead of jumping straight to the cap.
  const visibleCreatures = Math.round(lerp(3, CREATURE_CAP, t));

  return (
    <>
      <svg viewBox="0 0 220 120" className="h-full w-full">
        {gradients}
        {soil}
        <path
          d={`M110 108 C${108 - t * 2} 92 ${110 + t * 2} ${trunkTop + 14} 110 ${trunkTop}`}
          stroke="url(#trunk)"
          strokeWidth={trunkW}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse cx={110} cy={canopyCy} rx={canopyRx} ry={canopyRy} fill="url(#canopy)" />
        {pts.map((p, i) =>
          i < visibleCreatures ? (
            <g key={i}>{pickCreature(TREE_CREATURES, itemIds[i])(p.x, p.y, 6.5)}</g>
          ) : (
            <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="var(--accent-400)" opacity={0.85} />
          ),
        )}
      </svg>
      <Caption count={itemCount} label="마리가 놀러왔어요" />
    </>
  );
}

function Caption({ count, label, text, light }: { count?: number; label?: string; text?: string; light?: boolean }) {
  return (
    <p className={`absolute bottom-3 left-4 text-xs font-medium ${light ? "text-white/75" : "text-neutral-500"}`}>
      {text ?? `${count}${label}`}
    </p>
  );
}
