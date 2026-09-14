// Abstract, generative "growth" visuals per world — one focal shape with a
// soft gradient backdrop, item count expressed as accumulating fruit/stars/
// moons placed via phyllotaxis (sunflower-seed) packing, not a random
// scatter of literal emoji stickers (which read as a 2000s mini-homepage).
// All positions come from the index via sin/cos, so SSR and hydration match.

const TAU = Math.PI * 2;
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

function planetPoints(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = i * 0.78 * TAU;
    const x = 110 + Math.cos(angle) * 84;
    const y = 60 + Math.sin(angle) * 22;
    const depth = (Math.sin(angle) + 1) / 2;
    return { x, y, front: Math.sin(angle) > -0.1, scale: 0.8 + 0.35 * depth };
  });
}

export function WorldView({ worldType, itemCount }: { worldType: string; itemCount: number }) {
  const count = Math.max(Math.min(itemCount, 40), 1);

  if (worldType === "constellation") {
    const pts = phyllotaxis(Math.min(itemCount, 40) || 1, 92, 48, 110, 60);
    return (
      <div
        className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
        style={{ background: "radial-gradient(120% 100% at 30% 20%, #2c2264 0%, #17123a 60%, #100c2b 100%)" }}
      >
        {itemCount > 0 && (
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
            {pts.map((p, i) => (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={i % 6 === 0 ? 2.6 : 1.3}
                fill="#fff"
                filter="url(#star-glow)"
                opacity={0.95}
              >
                <animate attributeName="opacity" values="0.55;1;0.55" dur={`${3 + (i % 4)}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </svg>
        )}
        <Caption count={itemCount} label="개의 별" light />
      </div>
    );
  }

  if (worldType === "planet") {
    const pts = planetPoints(count);
    return (
      <div
        className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
        style={{ background: "linear-gradient(180deg, #eef4ff 0%, #dbe8ff 100%)" }}
      >
        <svg viewBox="0 0 220 120" className="h-full w-full">
          <defs>
            <radialGradient id="planet-core" cx="34%" cy="28%" r="75%">
              <stop offset="0%" stopColor="#ffd9a8" />
              <stop offset="55%" stopColor="var(--accent-400)" />
              <stop offset="100%" stopColor="var(--accent-600)" />
            </radialGradient>
          </defs>
          <ellipse cx={110} cy={88} rx={40} ry={6} fill="#5b7bb8" opacity={0.12} />
          <ellipse cx={110} cy={60} rx={92} ry={24} fill="none" stroke="var(--accent-300)" strokeWidth={1.2} strokeDasharray="1.5 4" opacity={0.6} />
          {itemCount > 0 &&
            pts
              .filter((p) => !p.front)
              .map((p, i) => <circle key={`b-${i}`} cx={p.x} cy={p.y} r={2.4 * p.scale} fill="var(--accent-300)" opacity={0.65} />)}
          <circle cx={110} cy={60} r={23} fill="url(#planet-core)" />
          {itemCount > 0 &&
            pts
              .filter((p) => p.front)
              .map((p, i) => <circle key={`f-${i}`} cx={p.x} cy={p.y} r={2.4 * p.scale} fill="var(--accent-500)" />)}
        </svg>
        <Caption count={itemCount} label="개의 달" />
      </div>
    );
  }

  // tree (default) -- grows through stages instead of jumping straight to
  // a full canopy: bare seed -> sprout with a leaf or two -> sapling with a
  // small canopy -> mature tree whose canopy/trunk keep thickening and
  // fruiting as itemCount climbs. Still purely a function of itemCount, no
  // randomness.
  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "linear-gradient(180deg, #f3faf4 0%, #e4f3e7 100%)" }}
    >
      <TreeStage itemCount={itemCount} />
    </div>
  );
}

function TreeStage({ itemCount }: { itemCount: number }) {
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
  const dots = phyllotaxis(Math.min(itemCount, 40), canopyRx * 0.85, canopyRy * 0.8, 110, canopyCy);

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
        {dots.map((d, i) => {
          const isFruit = i % 4 === 0;
          return <circle key={i} cx={d.x} cy={d.y} r={isFruit ? 3.4 : 2.6} fill={isFruit ? "var(--accent-400)" : "#6fc182"} opacity={0.92} />;
        })}
      </svg>
      <Caption count={itemCount} label="개의 열매" />
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
