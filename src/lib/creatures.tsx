import type { ReactNode } from "react";

// Small illustrated species, one per world, so a collected item shows up as
// an actual creature instead of a plain dot -- the "동물원처럼 모으기" request.
// Which species a given item renders as is a stable hash of the item's id,
// so it's deterministic (the same achievement always looks the same) with
// no extra state to store. Verified visually as static previews (individual
// species, then full scattered scenes) before writing this.

const INK = "#4a3423";
const INK_NIGHT = "#332a66";

function Body({ cx, cy, rx, ry, color, ink }: { cx: number; cy: number; rx: number; ry: number; color: string; ink: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} stroke={ink} strokeWidth={2} />;
}

function Belly({ cx, cy, rx, ry, color }: { cx: number; cy: number; rx: number; ry: number; color: string }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} opacity={0.85} />;
}

function Eyes({ cx, cy, spread, size, ink }: { cx: number; cy: number; spread: number; size: number; ink: string }) {
  const hi = size * 0.35;
  const off = size * 0.35;
  return (
    <>
      <circle cx={cx - spread} cy={cy} r={size} fill={ink} />
      <circle cx={cx - spread + off} cy={cy - off} r={hi} fill="#fff" />
      <circle cx={cx + spread} cy={cy} r={size} fill={ink} />
      <circle cx={cx + spread + off} cy={cy - off} r={hi} fill="#fff" />
    </>
  );
}

function Blush({ cx, cy, spread, color }: { cx: number; cy: number; spread: number; color: string }) {
  return (
    <>
      <ellipse cx={cx - spread} cy={cy + 5} rx={4.5} ry={2.6} fill={color} opacity={0.7} />
      <ellipse cx={cx + spread} cy={cy + 5} rx={4.5} ry={2.6} fill={color} opacity={0.7} />
    </>
  );
}

function Smile({ cx, cy, w, ink }: { cx: number; cy: number; w: number; ink: string }) {
  return <path d={`M${cx - w} ${cy} Q${cx} ${cy + w * 0.7} ${cx + w} ${cy}`} stroke={ink} strokeWidth={1.6} fill="none" strokeLinecap="round" />;
}

function GlowBody({ cx, cy, rx, ry, color }: { cx: number; cy: number; rx: number; ry: number; color: string }) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx + 2} ry={ry + 2} fill={color} opacity={0.35} style={{ filter: "blur(3px)" }} />
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} stroke={INK_NIGHT} strokeWidth={1.6} />
    </>
  );
}

export type Creature = (cx: number, cy: number, s: number) => ReactNode;

// ---------- tree (woodland) ----------
const Bunny: Creature = (cx, cy, s) => (
  <>
    <ellipse cx={cx - s * 0.5} cy={cy - s * 1.5} rx={s * 0.22} ry={s * 0.62} fill="#f7e2c4" stroke={INK} strokeWidth={1.6} transform={`rotate(-8 ${cx - s * 0.5} ${cy - s * 1.5})`} />
    <ellipse cx={cx + s * 0.5} cy={cy - s * 1.5} rx={s * 0.22} ry={s * 0.62} fill="#f7e2c4" stroke={INK} strokeWidth={1.6} transform={`rotate(8 ${cx + s * 0.5} ${cy - s * 1.5})`} />
    <Body cx={cx} cy={cy} rx={s * 0.85} ry={s * 0.75} color="#f7e2c4" ink={INK} />
    <Belly cx={cx} cy={cy + s * 0.2} rx={s * 0.5} ry={s * 0.42} color="#fff6ea" />
    <circle cx={cx - s * 0.62} cy={cy + s * 0.55} r={s * 0.28} fill="#f7e2c4" stroke={INK} strokeWidth={1.6} />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.28} size={s * 0.11} ink={INK} />
    <Blush cx={cx} cy={cy + s * 0.05} spread={s * 0.42} color="#ffb3a0" />
  </>
);

const Fox: Creature = (cx, cy, s) => (
  <>
    <path d={`M${cx - s * 0.55} ${cy - s * 0.9} L${cx - s * 0.15} ${cy - s * 1.4} L${cx - s * 0.05} ${cy - s * 0.75} Z`} fill="#f5a259" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
    <path d={`M${cx + s * 0.55} ${cy - s * 0.9} L${cx + s * 0.15} ${cy - s * 1.4} L${cx + s * 0.05} ${cy - s * 0.75} Z`} fill="#f5a259" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
    <path d={`M${cx + s * 0.7} ${cy + s * 0.3} Q${cx + s * 1.5} ${cy + s * 0.2} ${cx + s * 1.3} ${cy - s * 0.5} Q${cx + s * 1.1} ${cy - s * 0.1} ${cx + s * 0.75} ${cy + s * 0.15} Z`} fill="#f5a259" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
    <Body cx={cx} cy={cy} rx={s * 0.85} ry={s * 0.75} color="#f5a259" ink={INK} />
    <path d={`M${cx - s * 0.5} ${cy + s * 0.55} Q${cx} ${cy + s * 0.95} ${cx + s * 0.5} ${cy + s * 0.55} L${cx + s * 0.35} ${cy + s * 0.1} Q${cx} ${cy + s * 0.25} ${cx - s * 0.35} ${cy + s * 0.1} Z`} fill="#fff3df" stroke={INK} strokeWidth={1.4} />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.26} size={s * 0.1} ink={INK} />
  </>
);

const Squirrel: Creature = (cx, cy, s) => (
  <>
    <path d={`M${cx + s * 0.4} ${cy + s * 0.3} Q${cx + s * 1.5} ${cy + s * 0.6} ${cx + s * 1.1} ${cy - s * 0.8} Q${cx + s * 1.5} ${cy - s * 0.3} ${cx + s * 0.75} ${cy + s * 0.05} Z`} fill="#b98354" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
    <circle cx={cx - s * 0.5} cy={cy - s * 1.05} r={s * 0.22} fill="#b98354" stroke={INK} strokeWidth={1.6} />
    <circle cx={cx + s * 0.5} cy={cy - s * 1.05} r={s * 0.22} fill="#b98354" stroke={INK} strokeWidth={1.6} />
    <Body cx={cx} cy={cy} rx={s * 0.8} ry={s * 0.72} color="#b98354" ink={INK} />
    <Belly cx={cx} cy={cy + s * 0.15} rx={s * 0.44} ry={s * 0.4} color="#f0dcc0" />
    <Eyes cx={cx} cy={cy - s * 0.08} spread={s * 0.25} size={s * 0.1} ink={INK} />
    <Blush cx={cx} cy={cy + s * 0.08} spread={s * 0.38} color="#ffb3a0" />
  </>
);

const Bird: Creature = (cx, cy, s) => (
  <>
    <ellipse cx={cx - s * 0.95} cy={cy} rx={s * 0.3} ry={s * 0.45} fill="#7ec1e0" stroke={INK} strokeWidth={1.6} transform={`rotate(-25 ${cx - s * 0.95} ${cy})`} />
    <ellipse cx={cx + s * 0.95} cy={cy} rx={s * 0.3} ry={s * 0.45} fill="#7ec1e0" stroke={INK} strokeWidth={1.6} transform={`rotate(25 ${cx + s * 0.95} ${cy})`} />
    <Body cx={cx} cy={cy} rx={s * 0.78} ry={s * 0.72} color="#7ec1e0" ink={INK} />
    <Belly cx={cx} cy={cy + s * 0.15} rx={s * 0.4} ry={s * 0.35} color="#eaf6ff" />
    <Eyes cx={cx} cy={cy - s * 0.12} spread={s * 0.24} size={s * 0.1} ink={INK} />
    <path d={`M${cx - s * 0.1} ${cy + s * 0.02} Q${cx} ${cy + s * 0.18} ${cx + s * 0.1} ${cy + s * 0.02} Z`} fill="#f0a23c" stroke={INK} strokeWidth={1.2} />
  </>
);

export const TREE_CREATURES: Creature[] = [Bunny, Fox, Squirrel, Bird];

// ---------- constellation (celestial) ----------
const StarBunny: Creature = (cx, cy, s) => (
  <>
    <ellipse cx={cx - s * 0.5} cy={cy - s * 1.5} rx={s * 0.2} ry={s * 0.58} fill="#cdd6ff" stroke={INK_NIGHT} strokeWidth={1.4} transform={`rotate(-8 ${cx - s * 0.5} ${cy - s * 1.5})`} />
    <ellipse cx={cx + s * 0.5} cy={cy - s * 1.5} rx={s * 0.2} ry={s * 0.58} fill="#cdd6ff" stroke={INK_NIGHT} strokeWidth={1.4} transform={`rotate(8 ${cx + s * 0.5} ${cy - s * 1.5})`} />
    <GlowBody cx={cx} cy={cy} rx={s * 0.8} ry={s * 0.7} color="#cdd6ff" />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.26} size={s * 0.1} ink={INK_NIGHT} />
    <Blush cx={cx} cy={cy + s * 0.05} spread={s * 0.4} color="#c9a6ff" />
  </>
);

const CometFox: Creature = (cx, cy, s) => (
  <>
    <path d={`M${cx - s * 0.5} ${cy - s * 0.85} L${cx - s * 0.12} ${cy - s * 1.3} L${cx - s * 0.02} ${cy - s * 0.7} Z`} fill="#c9a6ff" stroke={INK_NIGHT} strokeWidth={1.4} />
    <path d={`M${cx + s * 0.5} ${cy - s * 0.85} L${cx + s * 0.12} ${cy - s * 1.3} L${cx + s * 0.02} ${cy - s * 0.7} Z`} fill="#c9a6ff" stroke={INK_NIGHT} strokeWidth={1.4} />
    <path d={`M${cx + s * 0.6} ${cy + s * 0.2} Q${cx + s * 1.7} ${cy} ${cx + s * 1.1} ${cy - s * 0.6}`} stroke="#c9a6ff" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
    <GlowBody cx={cx} cy={cy} rx={s * 0.78} ry={s * 0.7} color="#c9a6ff" />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.24} size={s * 0.1} ink={INK_NIGHT} />
  </>
);

const MoonCat: Creature = (cx, cy, s) => (
  <>
    <path d={`M${cx - s * 0.6} ${cy - s * 0.65} L${cx - s * 0.35} ${cy - s * 1.15} L${cx - s * 0.1} ${cy - s * 0.7} Z`} fill="#e7ecff" stroke={INK_NIGHT} strokeWidth={1.4} />
    <path d={`M${cx + s * 0.6} ${cy - s * 0.65} L${cx + s * 0.35} ${cy - s * 1.15} L${cx + s * 0.1} ${cy - s * 0.7} Z`} fill="#e7ecff" stroke={INK_NIGHT} strokeWidth={1.4} />
    <GlowBody cx={cx} cy={cy} rx={s * 0.78} ry={s * 0.7} color="#e7ecff" />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.25} size={s * 0.1} ink={INK_NIGHT} />
    <Blush cx={cx} cy={cy + s * 0.05} spread={s * 0.4} color="#c9a6ff" />
  </>
);

const NebulaOwl: Creature = (cx, cy, s) => (
  <>
    <ellipse cx={cx - s * 0.85} cy={cy + s * 0.1} rx={s * 0.3} ry={s * 0.5} fill="#7dd8c7" stroke={INK_NIGHT} strokeWidth={1.4} transform={`rotate(-15 ${cx - s * 0.85} ${cy + s * 0.1})`} />
    <ellipse cx={cx + s * 0.85} cy={cy + s * 0.1} rx={s * 0.3} ry={s * 0.5} fill="#7dd8c7" stroke={INK_NIGHT} strokeWidth={1.4} transform={`rotate(15 ${cx + s * 0.85} ${cy + s * 0.1})`} />
    <GlowBody cx={cx} cy={cy} rx={s * 0.78} ry={s * 0.75} color="#7dd8c7" />
    <circle cx={cx - s * 0.28} cy={cy - s * 0.1} r={s * 0.24} fill="#fff" />
    <circle cx={cx + s * 0.28} cy={cy - s * 0.1} r={s * 0.24} fill="#fff" />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.28} size={s * 0.13} ink={INK_NIGHT} />
  </>
);

export const CONSTELLATION_CREATURES: Creature[] = [StarBunny, CometFox, MoonCat, NebulaOwl];

// ---------- planet (alien) ----------
const BlobAlien: Creature = (cx, cy, s) => (
  <>
    <path d={`M${cx} ${cy - s * 0.75} Q${cx - s * 0.05} ${cy - s * 1.2} ${cx + s * 0.1} ${cy - s * 1.15}`} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
    <circle cx={cx + s * 0.12} cy={cy - s * 1.18} r={s * 0.09} fill="#a3e3b0" stroke={INK} strokeWidth={1.4} />
    <Body cx={cx} cy={cy} rx={s * 0.8} ry={s * 0.85} color="#a3e3b0" ink={INK} />
    <Belly cx={cx} cy={cy + s * 0.2} rx={s * 0.42} ry={s * 0.42} color="#e6fbe9" />
    <Eyes cx={cx} cy={cy - s * 0.15} spread={s * 0.26} size={s * 0.12} ink={INK} />
    <Blush cx={cx} cy={cy + s * 0.05} spread={s * 0.4} color="#ffb3a0" />
  </>
);

const TriEye: Creature = (cx, cy, s) => (
  <>
    <path d={`M${cx} ${cy - s * 0.8} Q${cx - s * 0.15} ${cy - s * 1.25} ${cx} ${cy - s * 1.3}`} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
    <circle cx={cx} cy={cy - s * 1.32} r={s * 0.1} fill="#fff" stroke={INK} strokeWidth={1.2} />
    <Body cx={cx} cy={cy} rx={s * 0.75} ry={s * 0.85} color="#c9a6ff" ink={INK} />
    <Eyes cx={cx} cy={cy - s * 0.2} spread={s * 0.24} size={s * 0.1} ink={INK} />
    <circle cx={cx} cy={cy + s * 0.02} r={s * 0.12} fill="#fff" stroke={INK} strokeWidth={1.4} />
    <circle cx={cx} cy={cy + s * 0.02} r={s * 0.05} fill={INK} />
  </>
);

const RingAlien: Creature = (cx, cy, s) => (
  <>
    <ellipse cx={cx} cy={cy + s * 0.15} rx={s * 1.25} ry={s * 0.3} fill="none" stroke="#ffb877" strokeWidth={2.4} opacity={0.85} />
    <Body cx={cx} cy={cy} rx={s * 0.78} ry={s * 0.78} color="#ffb877" ink={INK} />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.25} size={s * 0.11} ink={INK} />
    <Blush cx={cx} cy={cy + s * 0.08} spread={s * 0.4} color="#ff9d87" />
  </>
);

const Tentacle: Creature = (cx, cy, s) => (
  <>
    <path d={`M${cx - s * 0.4} ${cy + s * 0.7} q${-s * 0.15} ${s * 0.4} ${s * 0.05} ${s * 0.55}`} stroke="#7ec1e0" strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d={`M${cx} ${cy + s * 0.8} q0 ${s * 0.4} ${s * 0.15} ${s * 0.55}`} stroke="#7ec1e0" strokeWidth={5} fill="none" strokeLinecap="round" />
    <path d={`M${cx + s * 0.4} ${cy + s * 0.7} q${s * 0.15} ${s * 0.4} ${-s * 0.05} ${s * 0.55}`} stroke="#7ec1e0" strokeWidth={5} fill="none" strokeLinecap="round" />
    <Body cx={cx} cy={cy} rx={s * 0.75} ry={s * 0.7} color="#7ec1e0" ink={INK} />
    <Eyes cx={cx} cy={cy - s * 0.1} spread={s * 0.24} size={s * 0.11} ink={INK} />
    <Smile cx={cx} cy={cy + s * 0.18} w={s * 0.22} ink={INK} />
  </>
);

export const PLANET_CREATURES: Creature[] = [BlobAlien, TriEye, RingAlien, Tentacle];

export function pickCreature(list: Creature[], id: string): Creature {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}
