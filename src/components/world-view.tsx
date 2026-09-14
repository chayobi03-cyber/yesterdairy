import { CONSTELLATION_CREATURES, PLANET_CREATURES, pickCreature } from "@/lib/creatures";
import { COLORS, pickColorIndex } from "@/lib/colors";

// Each world is a small "collection" scene: unlocked items show up as real
// illustrated creatures (see lib/creatures.ts) scattered across a themed
// backdrop. Positioned entirely with percentages (never px tied to a fixed
// viewBox) so the same math works at any card width.
//
// Only the first CREATURE_CAP items render as full creature images; beyond
// that, remaining ones fall back to small plain dots so a big collection
// stays legible instead of turning into visual noise.
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

// cx/cy/rx/ry/count all in a 0-100 percentage space (not pixels), so callers
// don't need to know the card's actual rendered size.
function phyllotaxis(count: number, rx: number, ry: number, cx: number, cy: number) {
  return Array.from({ length: count }, (_, i) => {
    const idx = i + 1;
    const frac = Math.sqrt(idx / count);
    const angle = idx * GOLDEN_ANGLE;
    return { x: cx + Math.cos(angle) * rx * frac, y: cy + Math.sin(angle) * ry * frac };
  });
}

function Creature({ src, x, y, size }: { src: string; x: number; y: number; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- rendered at a custom percentage size varying per world/stage; next/image's fixed intrinsic width/height doesn't fit that.
    <img
      src={src}
      alt=""
      className="absolute h-auto object-contain drop-shadow-sm"
      style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, transform: "translate(-50%, -50%)" }}
    />
  );
}

function Dot({ x, y, color, light }: { x: number; y: number; color?: string; light?: boolean }) {
  return (
    <span
      className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
      style={{ left: `${x}%`, top: `${y}%`, background: color ?? (light ? "#fff" : "var(--accent-400)"), opacity: light ? 0.9 : 0.75 }}
    />
  );
}

export function WorldView({ worldType, itemIds }: { worldType: string; itemIds: string[] }) {
  if (worldType === "constellation") return <ConstellationScene itemIds={itemIds} />;
  if (worldType === "planet") return <PlanetScene itemIds={itemIds} />;
  if (worldType === "color") return <ColorScene itemIds={itemIds} />;
  return <TreeScene itemIds={itemIds} />;
}

function ColorScene({ itemIds }: { itemIds: string[] }) {
  const count = itemIds.length;
  const pts = phyllotaxis(Math.min(count, 40) || 1, 38, 32, 50, 48);

  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "linear-gradient(180deg, #fff9f2, #fff1e0)" }}
    >
      {count > 0 &&
        pts.map((p, i) => (
          <span
            key={i}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${11 + (i % 3) * 3}%`,
              aspectRatio: 1,
              background: COLORS[pickColorIndex(itemIds[i])].hex,
              boxShadow: "inset 0 -3px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)",
            }}
          />
        ))}
      <Caption count={count} label="가지 색을 모았어요" />
    </div>
  );
}

function ConstellationScene({ itemIds }: { itemIds: string[] }) {
  const count = itemIds.length;
  const pts = phyllotaxis(Math.min(count, 40) || 1, 40, 36, 50, 46);

  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "radial-gradient(120% 100% at 30% 20%, #2c2264 0%, #17123a 60%, #100c2b 100%)" }}
    >
      {count > 0 &&
        pts.map((p, i) =>
          i < CREATURE_CAP ? (
            <Creature key={i} src={pickCreature(CONSTELLATION_CREATURES, itemIds[i])} x={p.x} y={p.y} size={17} />
          ) : (
            <Dot key={i} x={p.x} y={p.y} light />
          ),
        )}
      <Caption count={count} label="마리의 별친구" light />
    </div>
  );
}

function PlanetScene({ itemIds }: { itemIds: string[] }) {
  const count = itemIds.length;
  const pts = phyllotaxis(Math.min(count, 40) || 1, 40, 34, 50, 48);

  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "linear-gradient(180deg, #eef0ff 0%, #dde6ff 60%, #cfe0ff 100%)" }}
    >
      {/* distant ringed planet, purely decorative flavor */}
      <div className="absolute rounded-full" style={{ left: "78%", top: "12%", width: "12%", aspectRatio: 1, background: "#ffd9a8" }} />
      <div
        className="absolute rounded-full border"
        style={{ left: "70%", top: "18%", width: "26%", aspectRatio: "20/5", borderColor: "#ffb877", opacity: 0.7, transform: "rotate(-15deg)" }}
      />
      {count > 0 &&
        pts.map((p, i) =>
          i < CREATURE_CAP ? (
            <Creature key={i} src={pickCreature(PLANET_CREATURES, itemIds[i])} x={p.x} y={p.y} size={17} />
          ) : (
            <Dot key={i} x={p.x} y={p.y} />
          ),
        )}
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
// tree whose canopy keeps growing and which visiting animals start to
// populate. Still purely a function of itemIds.length, no randomness.
function TreeStage({ itemIds }: { itemIds: string[] }) {
  const itemCount = itemIds.length;
  const ground = <div className="absolute rounded-full bg-black/[0.06]" style={{ left: "35%", top: "88%", width: "30%", height: "4%" }} />;
  const trunk = (opts: { leftPct: number; topPct: number; widthPct: number; heightPct: number }) => (
    <div
      className="absolute rounded-full"
      style={{
        left: `${opts.leftPct}%`,
        top: `${opts.topPct}%`,
        width: `${opts.widthPct}%`,
        height: `${opts.heightPct}%`,
        background: "linear-gradient(180deg, #b78d63, #8f6a48)",
      }}
    />
  );

  if (itemCount <= 0) {
    return (
      <>
        {ground}
        {trunk({ leftPct: 49, topPct: 75, widthPct: 2, heightPct: 13 })}
        <div className="absolute h-3 w-4 -translate-x-1/2 -translate-y-1/2 -rotate-[30deg] rounded-full bg-[#8fcf9e]" style={{ left: "46%", top: "77%" }} />
        <div className="absolute h-3 w-4 -translate-x-1/2 -translate-y-1/2 rotate-[30deg] rounded-full bg-[#8fcf9e]" style={{ left: "53%", top: "75%" }} />
        <Caption text="씨앗을 심었어요" />
      </>
    );
  }

  if (itemCount <= 2) {
    const leaves = [
      <div key="l1" className="absolute h-5 w-8 -translate-x-1/2 -translate-y-1/2 -rotate-[35deg] rounded-full bg-[#8fcf9e]" style={{ left: "45%", top: "71%" }} />,
      <div key="l2" className="absolute h-5 w-8 -translate-x-1/2 -translate-y-1/2 rotate-[30deg] rounded-full bg-[#a3dcae]" style={{ left: "55%", top: "65%" }} />,
    ].slice(0, itemCount);
    return (
      <>
        {ground}
        {trunk({ leftPct: 49, topPct: 60, widthPct: 2.2, heightPct: 28 })}
        {leaves}
        <Caption text="새싹이 돋았어요" />
      </>
    );
  }

  if (itemCount <= 6) {
    const dots = phyllotaxis(itemCount, 13, 12, 50, 50);
    return (
      <>
        {ground}
        {trunk({ leftPct: 49, topPct: 56, widthPct: 2.6, heightPct: 32 })}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: "50%", top: "50%", width: "26%", height: "31%", background: "radial-gradient(ellipse at 35% 30%, #bfe6c8, #8fcf9e)" }}
        />
        {dots.map((d, i) => (
          <Dot key={i} x={d.x} y={d.y} color="#6fc182" />
        ))}
        <Caption text="무럭무럭 자라는 중" />
      </>
    );
  }

  // Keeps the same lightweight CSS style as the seed/sprout/sapling stages
  // instead of switching to a photo or character images -- canopy keeps
  // growing and fills with colorful leaves, one per item.
  const t = clamp((itemCount - 7) / 33, 0, 1);
  const canopyW = lerp(35, 53, t);
  const canopyH = lerp(40, 63, t);
  const canopyCy = lerp(47, 40, t);
  const trunkTop = canopyCy + canopyH / 2 - 4;
  const pts = phyllotaxis(Math.min(itemCount, 40), (canopyW / 2) * 0.72, (canopyH / 2) * 0.68, 50, canopyCy);

  return (
    <>
      {ground}
      {trunk({ leftPct: 49, topPct: trunkTop, widthPct: lerp(2.8, 4, t), heightPct: 90 - trunkTop })}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: "50%", top: `${canopyCy}%`, width: `${canopyW}%`, height: `${canopyH}%`, background: "radial-gradient(ellipse at 35% 30%, #bfe6c8, #8fcf9e)" }}
      />
      {pts.map((p, i) => (
        <Leaf key={i} x={p.x} y={p.y} id={itemIds[i]} size={9 + (i % 3) * 1.5} />
      ))}
      <Caption count={itemCount} label="개의 잎을 모았어요" />
    </>
  );
}

const LEAF_PALETTE = ["#8ecae6", "#95d5a1", "#ffd166", "#ff9a5a", "#ffb6c1", "#c3aed6", "#4a8c6f", "#e8594a", "#2a6f97", "#a8a8a8", "#e07a5f", "#6fc182"];

function Leaf({ x, y, id, size }: { x: number; y: number; id: string; size: number }) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const color = LEAF_PALETTE[h % LEAF_PALETTE.length];
  const rotation = h % 360;
  return (
    <svg
      viewBox="0 0 24 24"
      className="absolute"
      style={{ left: `${x}%`, top: `${y}%`, width: `${size}%`, transform: `translate(-50%, -50%) rotate(${rotation}deg)` }}
    >
      <path d="M12 2 C4 6 4 16 12 22 C20 16 20 6 12 2 Z" fill={color} stroke="rgba(0,0,0,0.15)" strokeWidth={0.8} />
      <path d="M12 4 V20" stroke="rgba(0,0,0,0.18)" strokeWidth={0.6} />
    </svg>
  );
}

function Caption({ count, label, text, light }: { count?: number; label?: string; text?: string; light?: boolean }) {
  return (
    <p className={`absolute bottom-3 left-4 text-xs font-medium ${light ? "text-white/75" : "text-neutral-500"}`}>
      {text ?? `${count}${label}`}
    </p>
  );
}
