import { petStageFor, PET_STAGE_LABELS } from "@/lib/pet";

// Deterministic pet illustration -- appearance is purely a function of the
// current streak (via petStageFor), no randomness. Sticker-style outlines +
// eye highlights + rounded feet (rather than flat unoutlined shapes) so it
// reads as a cute mascot instead of plain geometry. Verified visually as a
// static preview across every stage, iterated twice, before porting here.

const INK = "#4a3423";

function Body({ cx, cy, r, color }: { cx: number; cy: number; r: number; color: string }) {
  return <ellipse cx={cx} cy={cy + r * 0.15} rx={r * 1.02} ry={r} fill={color} stroke={INK} strokeWidth={2.2} />;
}

function Eyes({ cx, cy, spread, size }: { cx: number; cy: number; spread: number; size: number }) {
  const highlight = size * 0.32;
  const offset = size * 0.35;
  return (
    <>
      <circle cx={cx - spread} cy={cy} r={size} fill={INK} />
      <circle cx={cx - spread + offset} cy={cy - offset} r={highlight} fill="#fff" />
      <circle cx={cx + spread} cy={cy} r={size} fill={INK} />
      <circle cx={cx + spread + offset} cy={cy - offset} r={highlight} fill="#fff" />
    </>
  );
}

function Blush({ cx, cy, spread }: { cx: number; cy: number; spread: number }) {
  return (
    <>
      <ellipse cx={cx - spread} cy={cy + 6} rx={6} ry={3.6} fill="#ff9d87" opacity={0.75} />
      <ellipse cx={cx + spread} cy={cy + 6} rx={6} ry={3.6} fill="#ff9d87" opacity={0.75} />
    </>
  );
}

function Beak({ cx, cy }: { cx: number; cy: number }) {
  return (
    <path
      d={`M${cx - 4.5} ${cy + 3} Q${cx} ${cy + 10} ${cx + 4.5} ${cy + 3} Z`}
      fill="#f0a23c"
      stroke={INK}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
  );
}

function Feet({ cx, cy }: { cx: number; cy: number }) {
  return (
    <>
      <ellipse cx={cx - 7} cy={cy} rx={5} ry={3.4} fill="#f0a23c" stroke={INK} strokeWidth={1.6} />
      <ellipse cx={cx + 7} cy={cy} rx={5} ry={3.4} fill="#f0a23c" stroke={INK} strokeWidth={1.6} />
    </>
  );
}

function Wings({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <>
      <ellipse
        cx={cx - r * 1.2}
        cy={cy}
        rx={8.5}
        ry={14}
        fill="#ffd9a8"
        stroke={INK}
        strokeWidth={2}
        transform={`rotate(-20 ${cx - r * 1.2} ${cy})`}
      />
      <ellipse
        cx={cx + r * 1.2}
        cy={cy}
        rx={8.5}
        ry={14}
        fill="#ffd9a8"
        stroke={INK}
        strokeWidth={2}
        transform={`rotate(20 ${cx + r * 1.2} ${cy})`}
      />
    </>
  );
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  const pts = [
    [x, y - s],
    [x + s * 0.3, y - s * 0.3],
    [x + s, y],
    [x + s * 0.3, y + s * 0.3],
    [x, y + s],
    [x - s * 0.3, y + s * 0.3],
    [x - s, y],
    [x - s * 0.3, y - s * 0.3],
  ]
    .map((p) => p.join(","))
    .join(" ");
  return <polygon points={pts} fill="#ffe08a" stroke={INK} strokeWidth={1} />;
}

const BODY_COLOR: Record<number, string> = { 2: "#ffe2b0", 3: "#ffd28a", 4: "#ffc670", 5: "#ffb85a" };
const BODY_PARAMS: Record<number, [number, number]> = { 2: [120, 26], 3: [122, 30], 4: [124, 34], 5: [124, 34] };

export function PetView({ streak }: { streak: number }) {
  const stage = petStageFor(streak);
  const cx = 95;

  return (
    <div
      className="relative h-52 overflow-hidden rounded-[28px] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_-10px_rgba(0,0,0,0.12)]"
      style={{ background: "linear-gradient(180deg, #fff7ec 0%, #ffedd6 100%)" }}
    >
      <svg viewBox="0 0 190 190" className="mx-auto h-full">
        {stage === 0 && (
          <>
            <ellipse cx={cx} cy={150} rx={34} ry={6} fill="#000" opacity={0.05} />
            <ellipse cx={cx} cy={130} rx={30} ry={38} fill="#fff3df" stroke={INK} strokeWidth={2.2} />
            <path
              d={`M${cx - 14} 120 l8 8 l-6 6 l9 9`}
              stroke="#e0b667"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {stage === 1 && (
          <>
            <ellipse cx={cx} cy={150} rx={34} ry={6} fill="#000" opacity={0.05} />
            <ellipse cx={cx} cy={136} rx={30} ry={30} fill="#fff3df" stroke={INK} strokeWidth={2.2} />
            <path d={`M${cx - 24} 130 q24 -18 48 0`} fill="none" stroke="#e0b667" strokeWidth={2} />
            <Body cx={cx} cy={100} r={16} color="#ffe2b0" />
            <Eyes cx={cx} cy={98} spread={6} size={2.4} />
            <Beak cx={cx} cy={101} />
          </>
        )}

        {stage >= 2 &&
          (() => {
            const [bodyCy, r] = BODY_PARAMS[stage];
            const bottom = bodyCy + r * 1.15;
            const footCy = bottom - 3;
            const groundCy = bottom + 5;
            const eyeCy = bodyCy - r * 0.3;
            return (
              <>
                <ellipse cx={cx} cy={groundCy} rx={r * 1.3} ry={6} fill="#000" opacity={0.05} />
                {stage >= 3 && <Wings cx={cx} cy={bodyCy} r={r} />}
                <Body cx={cx} cy={bodyCy} r={r} color={BODY_COLOR[stage]} />
                <Feet cx={cx} cy={footCy} />
                {stage === 5 && (
                  <path
                    d={`M${cx - 16} ${bodyCy - r - 2} L${cx - 10} ${bodyCy - r - 16} L${cx - 2} ${bodyCy - r - 4} L${cx} ${bodyCy - r - 20} L${cx + 2} ${bodyCy - r - 4} L${cx + 10} ${bodyCy - r - 16} L${cx + 16} ${bodyCy - r - 2} Z`}
                    fill="#f5a259"
                    stroke={INK}
                    strokeWidth={1.6}
                    strokeLinejoin="round"
                  />
                )}
                <Eyes cx={cx} cy={eyeCy} spread={r * 0.32} size={r * 0.11 + 2} />
                <Blush cx={cx} cy={bodyCy - r * 0.2} spread={r * 0.6} />
                <Beak cx={cx} cy={bodyCy - r * 0.05} />
                {stage >= 4 && (
                  <>
                    <Sparkle x={cx - r * 1.4} y={bodyCy - r * 1.6} s={7} />
                    <Sparkle x={cx + r * 1.5} y={bodyCy - r * 1.3} s={5} />
                  </>
                )}
                {stage === 5 && (
                  <>
                    <Sparkle x={cx - r * 0.9} y={groundCy} s={5} />
                    <Sparkle x={cx + r * 1.0} y={groundCy} s={5} />
                  </>
                )}
              </>
            );
          })()}
      </svg>

      <p className="absolute bottom-3 left-4 text-xs font-semibold text-[#8a6a4a]">
        {PET_STAGE_LABELS[stage]} · 연속 {streak}일
      </p>
    </div>
  );
}
