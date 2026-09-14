const WORLD_META: Record<string, { emoji: string; bg: string; decor: string }> = {
  tree: { emoji: "🌳", bg: "bg-emerald-50", decor: "🍎" },
  constellation: { emoji: "🌌", bg: "bg-indigo-950", decor: "⭐" },
  planet: { emoji: "🪐", bg: "bg-sky-100", decor: "🌙" },
};

// Deterministic layout (no Math.random — must render identically on the
// server and after hydration) using index-based modulo positions.
export function WorldView({ worldType, itemCount }: { worldType: string; itemCount: number }) {
  const meta = WORLD_META[worldType] ?? WORLD_META.tree;
  const count = Math.min(itemCount, 24);

  return (
    <div className={`relative flex h-40 items-center justify-center overflow-hidden rounded-3xl ${meta.bg}`}>
      <span className="text-6xl opacity-90">{meta.emoji}</span>
      {Array.from({ length: count }).map((_, i) => (
        <span
          key={i}
          className="absolute text-base"
          style={{ top: `${((i * 29) % 70) + 8}%`, left: `${((i * 41) % 82) + 6}%` }}
        >
          {meta.decor}
        </span>
      ))}
    </div>
  );
}
