// Redesigned away from the old "scattered emoji stickers on a flat color"
// look (read as a 2000s-era mini-homepage) toward what current diary apps
// (Day One, Stoic, Grid Diary) actually do for a "growth" visual: soft
// gradients, one abstract focal shape, and small glowing marks that
// accumulate — not literal clip-art fruit/stars pasted on top.
//
// Positions are derived from the index with sin/cos, not Math.random, so
// server and client render identical markup.

const TAU = Math.PI * 2;

function treePoints(count: number) {
  // Spread along the top canopy arc instead of a random scatter.
  return Array.from({ length: count }, (_, i) => {
    const t = count > 1 ? i / (count - 1) : 0.5;
    const angle = Math.PI + t * Math.PI; // left to right across the top half
    const rx = 78;
    const ry = 34;
    const x = 110 + Math.cos(angle) * rx;
    const y = 78 + Math.sin(angle) * ry + (i % 3) * 4;
    return { x, y };
  });
}

function constellationPoints(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i * 0.61803398875 + 0.15) * TAU; // golden-ratio spacing
    const r = 24 + ((i * 17) % 46);
    const x = 110 + Math.cos(angle) * r * 1.35;
    const y = 60 + Math.sin(angle) * r;
    return { x, y };
  });
}

function planetPoints(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = i * 0.7 * TAU;
    const x = 110 + Math.cos(angle) * 84;
    const y = 60 + Math.sin(angle) * 26;
    return { x, y, front: Math.sin(angle) > -0.15 };
  });
}

export function WorldView({ worldType, itemCount }: { worldType: string; itemCount: number }) {
  const count = Math.min(itemCount, 24);

  if (worldType === "constellation") {
    const pts = constellationPoints(count);
    return (
      <div
        className="relative h-52 overflow-hidden rounded-[28px]"
        style={{ background: "linear-gradient(165deg, #14102c 0%, #241a4d 55%, #2d1f5c 100%)" }}
      >
        <svg viewBox="0 0 220 120" className="h-full w-full">
          {pts.slice(1).map((p, i) => (
            <line
              key={`l-${i}`}
              x1={pts[i].x}
              y1={pts[i].y}
              x2={p.x}
              y2={p.y}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={0.6}
            />
          ))}
          {pts.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={i % 5 === 0 ? 2.4 : 1.5} fill="#fff" opacity={0.95}>
              <animate attributeName="opacity" values="0.5;1;0.5" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
            </circle>
          ))}
        </svg>
        <Caption count={itemCount} light label="개의 별" />
      </div>
    );
  }

  if (worldType === "planet") {
    const pts = planetPoints(count);
    return (
      <div
        className="relative h-52 overflow-hidden rounded-[28px]"
        style={{ background: "linear-gradient(165deg, #eef4ff 0%, #dfeaff 100%)" }}
      >
        <svg viewBox="0 0 220 120" className="h-full w-full">
          <ellipse cx={110} cy={60} rx={92} ry={30} fill="none" stroke="var(--accent-300)" strokeWidth={1} opacity={0.5} />
          {pts.filter((p) => !p.front).map((p, i) => (
            <circle key={`b-${i}`} cx={p.x} cy={p.y} r={2.6} fill="var(--accent-300)" opacity={0.7} />
          ))}
          <radialGradient id="planet-core" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="var(--accent-200)" />
            <stop offset="100%" stopColor="var(--accent-500)" />
          </radialGradient>
          <circle cx={110} cy={60} r={22} fill="url(#planet-core)" />
          {pts.filter((p) => p.front).map((p, i) => (
            <circle key={`f-${i}`} cx={p.x} cy={p.y} r={2.6} fill="var(--accent-500)" />
          ))}
        </svg>
        <Caption count={itemCount} label="개의 달" />
      </div>
    );
  }

  // tree (default)
  const pts = treePoints(count);
  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px]"
      style={{ background: "linear-gradient(165deg, #eef7ee 0%, #dcefe0 100%)" }}
    >
      <svg viewBox="0 0 220 120" className="h-full w-full">
        <path
          d="M110 120 V72"
          stroke="#a9845f"
          strokeWidth={5}
          strokeLinecap="round"
        />
        <path d="M110 90 Q90 78 78 62" stroke="#a9845f" strokeWidth={3} strokeLinecap="round" fill="none" />
        <path d="M110 90 Q130 78 142 62" stroke="#a9845f" strokeWidth={3} strokeLinecap="round" fill="none" />
        <ellipse cx={110} cy={62} rx={72} ry={30} fill="var(--accent-100)" opacity={0.6} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill="var(--accent-400)" opacity={0.9} />
        ))}
      </svg>
      <Caption count={itemCount} label="개의 잎" />
    </div>
  );
}

function Caption({ count, label, light }: { count: number; label: string; light?: boolean }) {
  return (
    <p
      className={`absolute bottom-3 left-4 text-xs ${light ? "text-white/70" : "text-neutral-500"}`}
    >
      {count}
      {label}
    </p>
  );
}
